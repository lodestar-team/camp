import { NextResponse } from "next/server";
import { ampQuery, table, hexCol } from "@/lib/amp";
import { checkRateLimit } from "@/lib/ratelimit";
import { handle, ApiError } from "@/lib/errors";
import { blockNumParam } from "@/lib/validate";
import { cacheHeadersFor } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 10;

type RouteContext = { params: Promise<{ n: string }> };

export async function GET(req: Request, ctx: RouteContext) {
  try {
    await checkRateLimit(req);
    const { n: raw } = await ctx.params;
    const n = blockNumParam.parse(raw);

    const blocksSql = `
      SELECT
        block_num,
        timestamp,
        ${hexCol("hash")} AS hash,
        ${hexCol("parent_hash")} AS parent_hash,
        ${hexCol("miner")} AS miner,
        gas_limit,
        gas_used,
        base_fee_per_gas
      FROM ${table("blocks")}
      WHERE block_num = ${n}
    `;
    const txsSql = `
      SELECT
        tx_index,
        ${hexCol("tx_hash")} AS tx_hash,
        ${hexCol("from")} AS from_addr,
        ${hexCol("to")}   AS to_addr,
        value,
        gas_used,
        status,
        type,
        gas_price,
        nonce
      FROM ${table("transactions")}
      WHERE block_num = ${n}
      ORDER BY tx_index
    `;
    const logsSql = `
      SELECT
        tx_index,
        log_index,
        ${hexCol("tx_hash")} AS tx_hash,
        ${hexCol("address")} AS address,
        ${hexCol("topic0")} AS topic0,
        ${hexCol("topic1")} AS topic1,
        ${hexCol("topic2")} AS topic2,
        ${hexCol("topic3")} AS topic3,
        encode(data, 'hex') AS data
      FROM ${table("logs")}
      WHERE block_num = ${n}
      ORDER BY tx_index, log_index
    `;

    const [blockRows, txRows, logRows] = await Promise.all([
      ampQuery(blocksSql),
      ampQuery(txsSql),
      ampQuery(logsSql),
    ]);
    if (blockRows.length === 0) {
      throw new ApiError("bad_request", 404, `block ${n} not indexed`);
    }
    const b = blockRows[0]!;

    const block = {
      block_num: Number(b.block_num),
      timestamp: b.timestamp,
      hash: `0x${b.hash}`,
      parent_hash: `0x${b.parent_hash}`,
      miner: `0x${b.miner}`,
      gas_limit: Number(b.gas_limit),
      gas_used: Number(b.gas_used),
      base_fee_per_gas: b.base_fee_per_gas,
    };
    const transactions = txRows.map((t) => ({
      tx_index: Number(t.tx_index),
      tx_hash: `0x${t.tx_hash}`,
      from: `0x${t.from_addr}`,
      to: t.to_addr ? `0x${t.to_addr}` : null,
      value: t.value,
      gas_used: Number(t.gas_used),
      gas_price: t.gas_price,
      status: Boolean(t.status),
      type: Number(t.type),
      nonce: Number(t.nonce),
    }));
    const logs = logRows.map((l) => ({
      tx_index: Number(l.tx_index),
      log_index: Number(l.log_index),
      tx_hash: `0x${l.tx_hash}`,
      address: `0x${l.address}`,
      topic0: l.topic0 ? `0x${l.topic0}` : null,
      topic1: l.topic1 ? `0x${l.topic1}` : null,
      topic2: l.topic2 ? `0x${l.topic2}` : null,
      topic3: l.topic3 ? `0x${l.topic3}` : null,
      data: `0x${l.data ?? ""}`,
    }));

    return NextResponse.json(
      { block, transactions, logs },
      { headers: cacheHeadersFor({ toBlock: n, tipBlock: n + 200 }) },
    );
  } catch (e) {
    if (e instanceof Error && e.name === "ZodError") {
      return handle(new ApiError("bad_request", 400, e.message));
    }
    return handle(e);
  }
}
