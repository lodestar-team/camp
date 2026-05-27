import { NextResponse } from "next/server";
import { ampQuery, hexLiteral, table } from "@/lib/amp";
import { checkRateLimit } from "@/lib/ratelimit";
import { handle, ApiError } from "@/lib/errors";
import { addressParam, rangeParams, bucketParam } from "@/lib/validate";
import { cacheHeadersFor } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 10;

const TRANSFER_SIG =
  "Transfer(address indexed from, address indexed to, uint256 value)";

type RouteContext = { params: Promise<{ addr: string }> };

export async function GET(req: Request, ctx: RouteContext) {
  try {
    await checkRateLimit(req);
    const { addr: rawAddr } = await ctx.params;
    const token = addressParam.parse(rawAddr);

    const url = new URL(req.url);
    const range = rangeParams.parse({
      from_block: url.searchParams.get("from_block"),
      to_block: url.searchParams.get("to_block"),
    });
    const bucket = bucketParam.parse(url.searchParams.get("bucket") ?? undefined);

    // Decode Transfer.value as decimal string, cast to Decimal128 for SUM.
    // Output `volume` comes back as a decimal value — we keep it stringified
    // in the JSON response by casting back to Utf8 to dodge JS Number precision.
    // TRY_CAST so spammy Transfer events whose value overflows Decimal128(38, 0)
    // contribute NULL to the SUM instead of aborting the query.
    const sql = `
      SELECT
        date_trunc('${bucket}', timestamp) AS bucket_ts,
        COUNT(*) AS transfers,
        arrow_cast(
          SUM(TRY_CAST(d['value'] AS DECIMAL(38, 0))),
          'Utf8'
        ) AS volume
      FROM (
        SELECT timestamp,
          (evm_decode_log(topic1, topic2, topic3, data,
            '${TRANSFER_SIG}')) AS d
        FROM ${table("logs")}
        WHERE block_num BETWEEN ${range.from_block} AND ${range.to_block}
          AND address = ${hexLiteral(token)}
          AND topic0  = evm_topic('Transfer(address,address,uint256)')
      )
      GROUP BY 1
      ORDER BY 1 ASC
      LIMIT 1000
    `.trim();

    const rows = await ampQuery(sql);
    const series = rows.map((r) => ({
      ts: r.bucket_ts,
      transfers: Number(r.transfers),
      volume: r.volume as string,
    }));

    return NextResponse.json(
      {
        token,
        bucket,
        from_block: range.from_block,
        to_block: range.to_block,
        count: series.length,
        series,
      },
      {
        headers: cacheHeadersFor({
          toBlock: range.to_block,
          tipBlock: range.to_block + 200,
        }),
      },
    );
  } catch (e) {
    if (e instanceof Error && e.name === "ZodError") {
      return handle(new ApiError("bad_request", 400, e.message));
    }
    return handle(e);
  }
}
