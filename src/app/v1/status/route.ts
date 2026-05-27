import { NextResponse } from "next/server";
import { ampQuery, table } from "@/lib/amp";
import { checkRateLimit } from "@/lib/ratelimit";
import { handle } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET(req: Request) {
  try {
    await checkRateLimit(req);
    const started = Date.now();
    const rows = await ampQuery(
      `SELECT
         MAX(block_num)              AS tip,
         MIN(block_num)              AS earliest,
         COUNT(*)                    AS blocks_indexed,
         arrow_cast(MIN(timestamp), 'Utf8') AS earliest_ts,
         arrow_cast(MAX(timestamp), 'Utf8') AS latest_ts
       FROM ${table("blocks")}`,
    );
    const row = (rows[0] ?? {}) as {
      tip?: number;
      earliest?: number;
      blocks_indexed?: number;
      earliest_ts?: string;
      latest_ts?: string;
    };
    const earliestTs = row.earliest_ts ? new Date(row.earliest_ts).getTime() : null;
    const latestTs = row.latest_ts ? new Date(row.latest_ts).getTime() : null;
    const historySeconds =
      earliestTs && latestTs ? Math.max(0, Math.round((latestTs - earliestTs) / 1000)) : 0;
    return NextResponse.json(
      {
        chain: "arbitrum-one",
        latest_indexed_block: Number(row.tip ?? 0),
        earliest_indexed_block: Number(row.earliest ?? 0),
        blocks_indexed: Number(row.blocks_indexed ?? 0),
        history_seconds: historySeconds,
        earliest_indexed_at: row.earliest_ts ?? null,
        latest_indexed_at: row.latest_ts ?? null,
        elapsed_ms: Date.now() - started,
      },
      {
        headers: { "Cache-Control": "public, max-age=5, s-maxage=5" },
      },
    );
  } catch (e) {
    return handle(e);
  }
}
