import { NextResponse } from "next/server";
import { ampQuery, hexLiteral, table } from "@/lib/amp";
import { checkRateLimit } from "@/lib/ratelimit";
import { handle, ApiError } from "@/lib/errors";
import { addressParam, rangeParams, bucketParam } from "@/lib/validate";
import { cacheHeadersFor } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 10;

type RouteContext = { params: Promise<{ addr: string }> };

export async function GET(req: Request, ctx: RouteContext) {
  try {
    await checkRateLimit(req);
    const { addr: rawAddr } = await ctx.params;
    const address = addressParam.parse(rawAddr);

    const url = new URL(req.url);
    const range = rangeParams.parse({
      from_block: url.searchParams.get("from_block"),
      to_block: url.searchParams.get("to_block"),
    });
    const bucket = bucketParam.parse(url.searchParams.get("bucket") ?? undefined);

    const sql = `
      SELECT
        date_trunc('${bucket}', timestamp) AS bucket_ts,
        COUNT(*) AS logs
      FROM ${table("logs")}
      WHERE block_num BETWEEN ${range.from_block} AND ${range.to_block}
        AND address = ${hexLiteral(address)}
      GROUP BY 1
      ORDER BY 1 ASC
      LIMIT 1000
    `.trim();

    const rows = await ampQuery(sql);
    const series = rows.map((r) => ({
      ts: r.bucket_ts,
      logs: Number(r.logs),
    }));

    return NextResponse.json(
      {
        address,
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
