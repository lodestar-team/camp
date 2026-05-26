import { NextResponse } from "next/server";
import { ampQuery, hexCol, hexLiteral, table } from "@/lib/amp";
import { checkRateLimit } from "@/lib/ratelimit";
import { handle, ApiError } from "@/lib/errors";
import { addressParam, rangeParams, limitParam, addressToTopic } from "@/lib/validate";
import { cacheHeadersFor } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 10;

const TRANSFER_SIG =
  "Transfer(address indexed from, address indexed to, uint256 value)";

type RouteContext = { params: Promise<{ addr: string }> };

export async function GET(req: Request, ctx: RouteContext) {
  try {
    await checkRateLimit(req);
    const { addr: rawAddr } = await ctx.params;
    const address = addressParam.parse(rawAddr);

    const url = new URL(req.url);
    const range = rangeParams.parse({
      from_block: url.searchParams.get("from_block"),
      to_block: url.searchParams.get("to_block"),
    });
    const limit = limitParam.parse(url.searchParams.get("limit") ?? undefined);
    const direction = (url.searchParams.get("direction") ?? "all").toLowerCase();
    if (!["all", "in", "out"].includes(direction)) {
      throw new ApiError(
        "bad_request",
        400,
        "direction must be 'all', 'in', or 'out'",
      );
    }
    const tokenRaw = url.searchParams.get("token");
    const tokenAddr = tokenRaw ? addressParam.parse(tokenRaw) : null;

    const padded = hexLiteral(addressToTopic(address));
    let topicFilter: string;
    if (direction === "out") topicFilter = `topic1 = ${padded}`;
    else if (direction === "in") topicFilter = `topic2 = ${padded}`;
    else topicFilter = `(topic1 = ${padded} OR topic2 = ${padded})`;

    const filters: string[] = [
      `block_num BETWEEN ${range.from_block} AND ${range.to_block}`,
      `topic0 = evm_topic('Transfer(address,address,uint256)')`,
      topicFilter,
    ];
    if (tokenAddr) filters.push(`address = ${hexLiteral(tokenAddr)}`);

    const sql = `
      SELECT
        block_num,
        log_index,
        ${hexCol("tx_hash")} AS tx_hash,
        ${hexCol("token_addr")} AS token,
        d['from']  AS from_addr,
        d['to']    AS to_addr,
        d['value'] AS value
      FROM (
        SELECT
          block_num, log_index, tx_hash, address AS token_addr,
          (evm_decode_log(topic1, topic2, topic3, data,
            '${TRANSFER_SIG}')) AS d
        FROM ${table("logs")}
        WHERE ${filters.join(" AND ")}
      )
      ORDER BY block_num DESC, log_index DESC
      LIMIT ${limit}
    `.trim();

    const rows = await ampQuery(sql);
    const transfers = rows.map((r) => ({
      block_num: Number(r.block_num),
      log_index: Number(r.log_index),
      tx_hash: `0x${r.tx_hash}`,
      token: `0x${r.token}`,
      from: `0x${r.from_addr}`,
      to: `0x${r.to_addr}`,
      value: r.value as string,
    }));

    return NextResponse.json(
      { count: transfers.length, transfers },
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
