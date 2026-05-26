import { NextResponse } from "next/server";
import { ampQuery, hexCol, hexLiteral, table } from "@/lib/amp";
import { checkRateLimit } from "@/lib/ratelimit";
import { handle, ApiError } from "@/lib/errors";
import { addressParam, rangeParams, limitParam } from "@/lib/validate";
import { cacheHeadersFor } from "@/lib/cache";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 10;

const TRANSFER_SIG =
  "Transfer(address indexed from, address indexed to, uint256 value)";

// min_value must be a non-negative integer with up to 38 digits (Decimal128
// range). Take it as a string so we don't lose precision via JS numbers.
const minValueParam = z
  .string()
  .regex(/^\d{1,38}$/, "min_value must be 1-38 digits, no decimals");

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
    const minValue = minValueParam.parse(
      url.searchParams.get("min_value") ?? "0",
    );

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
      WHERE arrow_cast(d['value'], 'Decimal128(38, 0)') >= ${minValue}
      ORDER BY block_num DESC, log_index DESC
      LIMIT ${limit}
    `.trim();

    const rows = await ampQuery(sql);
    const transfers = rows.map((r) => ({
      block_num: Number(r.block_num),
      log_index: Number(r.log_index),
      tx_hash: `0x${r.tx_hash}`,
      from: `0x${r.from_addr}`,
      to: `0x${r.to_addr}`,
      value: r.value as string,
    }));

    return NextResponse.json(
      {
        token,
        min_value: minValue,
        count: transfers.length,
        transfers,
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
