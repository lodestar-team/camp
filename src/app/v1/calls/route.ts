import { NextResponse } from "next/server";
import { ampQuery, hexCol } from "@/lib/amp";
import { checkRateLimit } from "@/lib/ratelimit";
import { handle, ApiError } from "@/lib/errors";
import { limitParam } from "@/lib/validate";
import { cacheHeadersFor } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 10;

// Full-instrumentation internal-call (trace) data — sourced from Pinax
// (Firehose→Parquet) and materialised in-engine by camp-node's `pinax` source.
// This is data a plain JSON-RPC indexer cannot produce. Showcase dataset is an
// ETH-mainnet slice (Arbitrum full instrumentation pending upstream at Pinax).
const CALLS_DATASET = process.env.PINAX_DATASET ?? "_/eth@1.0.0";
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
      !Number.isInteger(from_block) ||
      !Number.isInteger(to_block) ||
      from_block < 0 ||
      to_block < from_block ||
      to_block - from_block > MAX_SPAN
    ) {
      throw new ApiError("bad_request", 400, `invalid block range (max span ${MAX_SPAN})`);
    }
    const limit = limitParam.parse(url.searchParams.get("limit") ?? undefined);

    const sql = `
      SELECT
        block_num,
        tx_index,
        "index" AS call_index,
        depth,
        call_type,
        gas_limit,
        gas_consumed,
        ${hexCol("tx_hash")} AS tx_hash,
        ${hexCol("caller")} AS caller,
        ${hexCol("address")} AS address,
        arrow_cast(value, 'Utf8') AS value
      FROM "${CALLS_DATASET}".calls
      WHERE block_num BETWEEN ${from_block} AND ${to_block}
      ORDER BY block_num ASC, "index" ASC
      LIMIT ${limit}
    `.trim();

    const rows = await ampQuery(sql);
    const calls = rows.map((r) => ({
      block_num: Number(r.block_num),
      tx_index: Number(r.tx_index),
      call_index: Number(r.call_index),
      depth: Number(r.depth),
      call_type: Number(r.call_type),
      gas_limit: Number(r.gas_limit),
      gas_consumed: Number(r.gas_consumed),
      tx_hash: `0x${r.tx_hash}`,
      caller: `0x${r.caller}`,
      address: `0x${r.address}`,
      value: r.value as string, // decimal-string, big-int safe
    }));

    return NextResponse.json(
      { dataset: CALLS_DATASET, count: calls.length, calls },
      { headers: cacheHeadersFor({ toBlock: to_block, tipBlock: to_block + 200 }) },
    );
  } catch (e) {
    if (e instanceof Error && e.name === "ZodError") {
      return handle(new ApiError("bad_request", 400, e.message));
    }
    return handle(e);
  }
}
