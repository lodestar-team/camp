import { NextResponse } from "next/server";
import { ampQuery, hexCol, hexLiteral, resolveRange, table } from "@/lib/amp";
import { checkRateLimit } from "@/lib/ratelimit";
import { handle, ApiError } from "@/lib/errors";
import { addressParam, limitParam } from "@/lib/validate";
import { cacheHeadersFor } from "@/lib/cache";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 10;

const TRANSFER_SIG =
  "Transfer(address indexed from, address indexed to, uint256 value)";

// Native USDC on Arbitrum (6 decimals) — the default token for a bare call so
// the "whale ticker" returns meaningful $-denominated results out of the box.
const USDC = "0xaf88d065e77c8cc2239327c5edb3a432268e5831";
const USDC_1M = "1000000000000"; // $1,000,000 in USDC base units (6 decimals)

// min_value must be a non-negative integer with up to 38 digits (Decimal128
// range). Take it as a string so we don't lose precision via JS numbers.
const minValueParam = z
  .string()
  .regex(/^\d{1,38}$/, "min_value must be 1-38 digits, no decimals");

export async function GET(req: Request) {
  try {
    await checkRateLimit(req);
    const url = new URL(req.url);
    // token OPTIONAL: defaults to USDC so a bare call returns real whale
    // transfers ($1M+ by default). Pass ?token=0x… for any other ERC-20.
    const tokenRaw = url.searchParams.get("token");
    const token = tokenRaw ? addressParam.parse(tokenRaw) : USDC;
    // range OPTIONAL: defaults to a recent window up to the tip.
    const range = await resolveRange(url.searchParams, 10_000);
    const limit = limitParam.parse(url.searchParams.get("limit") ?? undefined);
    // min_value OPTIONAL: defaults to $1M when scoped to the default USDC token,
    // else 0 (caller picks the threshold for their token's decimals).
    const minValueDefault = tokenRaw ? "0" : USDC_1M;
    const minValue = minValueParam.parse(
      url.searchParams.get("min_value") ?? minValueDefault,
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
      -- TRY_CAST so junk Transfer events with values that overflow
      -- Decimal128(38, 0) (e.g. spam tokens emitting 2^255-1) return NULL
      -- instead of aborting the entire query. NULL >= n is filtered out.
      WHERE TRY_CAST(d['value'] AS DECIMAL(38, 0)) >= ${minValue}
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
