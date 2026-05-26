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
      `SELECT MAX(block_num) AS tip, COUNT(*) AS blocks_indexed
       FROM ${table("blocks")}`,
    );
    const row = rows[0] ?? {};
    return NextResponse.json(
      {
        chain: "arbitrum-one",
        latest_indexed_block: Number(row.tip ?? 0),
        blocks_indexed: Number(row.blocks_indexed ?? 0),
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
