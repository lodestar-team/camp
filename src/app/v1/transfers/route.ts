import { NextResponse } from "next/server";
import { ampQuery, table, hexLiteral, hexCol } from "@/lib/amp";
import { checkRateLimit } from "@/lib/ratelimit";
import { handle, ApiError } from "@/lib/errors";
import { addressParam, rangeParams, limitParam } from "@/lib/validate";
import { cacheHeadersFor } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 10;

// Standard ERC-20/721 Transfer signature, used both to derive the topic0
// filter and to decode every matching log into typed fields.
const TRANSFER_SIG =
  "Transfer(address indexed from, address indexed to, uint256 value)";

export async function GET(req: Request) {
  try {
    await checkRateLimit(req);
    const url = new URL(req.url);
    const token = addressParam.parse(url.searchParams.get("token"));
    const range = rangeParams.parse({
      from_block: url.searchParams.get("from_block"),
      to_block: url.searchParams.get("to_block"),
    });
    const limit = limitParam.parse(url.searchParams.get("limit") ?? undefined);

    // Decoded path: evm_decode_log returns a struct {from, to, value} of
    // Utf8 fields. Bracket-access them in the projection (dot access is
    // unsupported). `value` stays as a decimal string in the response —
    // exact, no precision loss, and clients that need a number can do
    // `BigInt(v)` themselves.
    const sql = `
      SELECT
        block_num,
        log_index,
        ${hexCol("tx_hash")} AS tx_hash,
        d['from']  AS from_addr,
        d['to']    AS to_addr,
        d['value'] AS value
      FROM (
        SELECT
          block_num, log_index, tx_hash,
          (evm_decode_log(topic1, topic2, topic3, data,
            '${TRANSFER_SIG}')) AS d
        FROM ${table("logs")}
        WHERE block_num BETWEEN ${range.from_block} AND ${range.to_block}
          AND address = ${hexLiteral(token)}
          AND topic0  = evm_topic('Transfer(address,address,uint256)')
      )
      ORDER BY block_num ASC, log_index ASC
      LIMIT ${limit}
    `.trim();

    const rows = await ampQuery(sql);
    const transfers = rows.map((r) => ({
      block_num: Number(r.block_num),
      log_index: Number(r.log_index),
      tx_hash: `0x${r.tx_hash}`,
      from: `0x${r.from_addr}`,
      to: `0x${r.to_addr}`,
      value: r.value as string, // decimal-string, big-int safe
    }));

    const tipRows = await ampQuery(
      `SELECT MAX(block_num) AS tip FROM ${table("blocks")}`,
    );
    const tipBlock = Number(tipRows[0]?.tip ?? range.to_block);

    return NextResponse.json(
      { count: transfers.length, transfers },
      { headers: cacheHeadersFor({ toBlock: range.to_block, tipBlock }) },
    );
  } catch (e) {
    if (e instanceof Error && e.name === "ZodError") {
      return handle(new ApiError("bad_request", 400, e.message));
    }
    return handle(e);
  }
}
