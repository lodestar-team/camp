import { NextResponse } from "next/server";
import { ampQuery } from "@/lib/amp";
import { checkRateLimit } from "@/lib/ratelimit";
import { handle, ApiError } from "@/lib/errors";
import { limitParam } from "@/lib/validate";
import { cacheHeadersFor } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 10;

// nonce_changes = every account nonce increment, from the pinax source.
const DATASET = process.env.PINAX_DATASET ?? "_/eth@1.0.0";
const DEFAULT_FROM = 2_000_000;
const DEFAULT_TO = 2_002_000;
const MAX_SPAN = 100_000;

export async function GET(req: Request) {
  try {
    await checkRateLimit(req);
    const url = new URL(req.url);
    const from_block = Number(url.searchParams.get("from_block") ?? DEFAULT_FROM);
    const to_block = Number(url.searchParams.get("to_block") ?? DEFAULT_TO);
    if (
      !Number.isInteger(from_block) || !Number.isInteger(to_block) ||
      from_block < 0 || to_block < from_block || to_block - from_block > MAX_SPAN
    ) {
      throw new ApiError("bad_request", 400, `invalid block range (max span ${MAX_SPAN})`);
    }
    const limit = limitParam.parse(url.searchParams.get("limit") ?? undefined);

    const sql = `
      SELECT
        block_num, ordinal,
        encode(arrow_cast(address, 'Binary'), 'hex') AS address,
        old_value, new_value,
        encode(arrow_cast(tx_hash, 'Binary'), 'hex') AS tx_hash
      FROM "${DATASET}".nonce_changes
      WHERE block_num BETWEEN ${from_block} AND ${to_block}
      ORDER BY block_num ASC, ordinal ASC
      LIMIT ${limit}
    `.trim();

    const rows = await ampQuery(sql);
    const changes = rows.map((r) => ({
      block_num: Number(r.block_num),
      ordinal: Number(r.ordinal),
      address: `0x${r.address}`,
      old_value: Number(r.old_value),
      new_value: Number(r.new_value),
      tx_hash: r.tx_hash ? `0x${r.tx_hash}` : null,
    }));

    return NextResponse.json(
      { dataset: DATASET, count: changes.length, nonce_changes: changes },
      { headers: cacheHeadersFor({ toBlock: to_block, tipBlock: to_block + 200 }) },
    );
  } catch (e) {
    if (e instanceof Error && e.name === "ZodError") {
      return handle(new ApiError("bad_request", 400, e.message));
    }
    return handle(e);
  }
}
