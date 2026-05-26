import { NextResponse } from "next/server";
import { ampQuery, table } from "@/lib/amp";
import { checkRateLimit } from "@/lib/ratelimit";
import { handle, ApiError } from "@/lib/errors";
import { rangeParams, bucketParam } from "@/lib/validate";
import { cacheHeadersFor } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET(req: Request) {
  try {
    await checkRateLimit(req);
    const url = new URL(req.url);
    const range = rangeParams.parse({
      from_block: url.searchParams.get("from_block"),
      to_block: url.searchParams.get("to_block"),
    });
    const bucket = bucketParam.parse(url.searchParams.get("bucket") ?? undefined);

    const sql = `
      SELECT
        date_trunc('${bucket}', timestamp) AS bucket_ts,
        COUNT(*) AS blocks,
        SUM(gas_used) AS total_gas,
        AVG(gas_used) AS avg_gas,
        MIN(base_fee_per_gas) AS min_base_fee,
        AVG(base_fee_per_gas) AS avg_base_fee,
        MAX(base_fee_per_gas) AS max_base_fee
      FROM ${table("blocks")}
      WHERE block_num BETWEEN ${range.from_block} AND ${range.to_block}
      GROUP BY 1
      ORDER BY 1 ASC
      LIMIT 1000
    `.trim();

    const rows = await ampQuery(sql);
    const series = rows.map((r) => ({
      ts: r.bucket_ts,
      blocks: Number(r.blocks),
      total_gas: r.total_gas,
      avg_gas: Number(r.avg_gas),
      min_base_fee: r.min_base_fee,
      avg_base_fee: r.avg_base_fee,
      max_base_fee: r.max_base_fee,
    }));

    return NextResponse.json(
      {
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
