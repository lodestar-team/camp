import { NextResponse } from "next/server";
import { ampQuery, table, hexLiteral, hexCol } from "@/lib/amp";
import { checkRateLimit } from "@/lib/ratelimit";
import { handle, ApiError } from "@/lib/errors";
import { addressParam, rangeParams, limitParam } from "@/lib/validate";
import { TRANSFER_TOPIC0 } from "@/lib/signatures";
import { cacheHeadersFor } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 10;

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

    const sql = `
      SELECT
        block_num,
        log_index,
        ${hexCol("tx_hash")} AS tx_hash,
        ${hexCol("topic1")}  AS from_addr_padded,
        ${hexCol("topic2")}  AS to_addr_padded,
        encode(data, 'hex')  AS amount_hex
      FROM ${table("logs")}
      WHERE block_num BETWEEN ${range.from_block} AND ${range.to_block}
        AND address = ${hexLiteral(token)}
        AND topic0  = ${hexLiteral(TRANSFER_TOPIC0)}
      ORDER BY block_num ASC, log_index ASC
      LIMIT ${limit}
    `.trim();

    const rows = await ampQuery(sql);
    const transfers = rows.map((r) => ({
      block_num: Number(r.block_num),
      log_index: Number(r.log_index),
      tx_hash: `0x${r.tx_hash}`,
      from: paddedTopicToAddress(r.from_addr_padded as string | null),
      to: paddedTopicToAddress(r.to_addr_padded as string | null),
      amount_hex: `0x${r.amount_hex ?? ""}`,
    }));

    const tipRows = await ampQuery(`SELECT MAX(block_num) AS tip FROM ${table("blocks")}`);
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

function paddedTopicToAddress(padded: string | null): string | null {
  if (!padded) return null;
  return `0x${padded.slice(-40)}`;
}
