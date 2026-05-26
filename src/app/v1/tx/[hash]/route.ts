import { NextResponse } from "next/server";
import { ampQuery, fetchTip, hexCol, hexLiteral, table } from "@/lib/amp";
import { checkRateLimit } from "@/lib/ratelimit";
import { handle, ApiError } from "@/lib/errors";
import { txHashParam, blockNumParam } from "@/lib/validate";
import { cacheHeadersFor } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 10;

// Default search window: 100k blocks back from tip (~7 hours of Arbitrum).
// Callers can widen with explicit from_block/to_block (capped at 100k span).
const MAX_SPAN = 100_000;
const DEFAULT_SPAN = 100_000;

type RouteContext = { params: Promise<{ hash: string }> };

export async function GET(req: Request, ctx: RouteContext) {
  try {
    await checkRateLimit(req);
    const { hash: rawHash } = await ctx.params;
    const txHash = txHashParam.parse(rawHash);

    const url = new URL(req.url);
    const fromQ = url.searchParams.get("from_block");
    const toQ = url.searchParams.get("to_block");

    let fromBlock: number;
    let toBlock: number;
    if (fromQ && toQ) {
      fromBlock = blockNumParam.parse(fromQ);
      toBlock = blockNumParam.parse(toQ);
      if (toBlock < fromBlock) {
        throw new ApiError("bad_request", 400, "to_block must be >= from_block");
      }
      if (toBlock - fromBlock > MAX_SPAN) {
        throw new ApiError(
          "bad_request",
          400,
          `block range cannot exceed ${MAX_SPAN}`,
        );
      }
    } else {
      const tip = await fetchTip();
      toBlock = tip;
      fromBlock = Math.max(0, tip - DEFAULT_SPAN);
    }

    const txSql = `
      SELECT
        block_num,
        tx_index,
        ${hexCol("tx_hash")} AS tx_hash,
        ${hexCol("from")} AS from_addr,
        ${hexCol("to")}   AS to_addr,
        value,
        gas_used,
        gas_price,
        status,
        type,
        nonce
      FROM ${table("transactions")}
      WHERE block_num BETWEEN ${fromBlock} AND ${toBlock}
        AND tx_hash = ${hexLiteral(txHash)}
    `;
    const logsSql = `
      SELECT
        log_index,
        ${hexCol("address")} AS address,
        ${hexCol("topic0")} AS topic0,
        ${hexCol("topic1")} AS topic1,
        ${hexCol("topic2")} AS topic2,
        ${hexCol("topic3")} AS topic3,
        encode(data, 'hex') AS data
      FROM ${table("logs")}
      WHERE block_num BETWEEN ${fromBlock} AND ${toBlock}
        AND tx_hash = ${hexLiteral(txHash)}
      ORDER BY log_index
    `;

    const [txRows, logRows] = await Promise.all([
      ampQuery(txSql),
      ampQuery(logsSql),
    ]);
    if (txRows.length === 0) {
      throw new ApiError(
        "bad_request",
        404,
        `tx ${txHash} not found in blocks [${fromBlock}, ${toBlock}]`,
        "widen with ?from_block=&to_block= or check the hash",
      );
    }
    const t = txRows[0]!;

    const transaction = {
      block_num: Number(t.block_num),
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
    };
    const logs = logRows.map((l) => ({
      log_index: Number(l.log_index),
      address: `0x${l.address}`,
      topic0: l.topic0 ? `0x${l.topic0}` : null,
      topic1: l.topic1 ? `0x${l.topic1}` : null,
      topic2: l.topic2 ? `0x${l.topic2}` : null,
      topic3: l.topic3 ? `0x${l.topic3}` : null,
      data: `0x${l.data ?? ""}`,
    }));

    return NextResponse.json(
      { transaction, logs },
      {
        headers: cacheHeadersFor({
          toBlock: transaction.block_num,
          tipBlock: toBlock + 200,
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
