import { NextResponse } from "next/server";
import { ampQuery, hexCol, hexLiteral, table } from "@/lib/amp";
import { checkRateLimit } from "@/lib/ratelimit";
import { handle, ApiError } from "@/lib/errors";
import { addressParam, rangeParams, limitParam, addressToTopic } from "@/lib/validate";
import { TRANSFER_TOPIC0 } from "@/lib/signatures";
import { cacheHeadersFor } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 10;

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
      `topic0 = ${hexLiteral(TRANSFER_TOPIC0)}`,
      topicFilter,
    ];
    if (tokenAddr) filters.push(`address = ${hexLiteral(tokenAddr)}`);

    const sql = `
      SELECT
        block_num,
        log_index,
        ${hexCol("tx_hash")} AS tx_hash,
        ${hexCol("address")} AS token,
        ${hexCol("topic1")}  AS from_padded,
        ${hexCol("topic2")}  AS to_padded,
        encode(data, 'hex')  AS amount_hex
      FROM ${table("logs")}
      WHERE ${filters.join(" AND ")}
      ORDER BY block_num DESC, log_index DESC
      LIMIT ${limit}
    `;
    const rows = await ampQuery(sql);
    const transfers = rows.map((r) => ({
      block_num: Number(r.block_num),
      log_index: Number(r.log_index),
      tx_hash: `0x${r.tx_hash}`,
      token: `0x${r.token}`,
      from: paddedToAddress(r.from_padded as string | null),
      to: paddedToAddress(r.to_padded as string | null),
      amount_hex: `0x${r.amount_hex ?? ""}`,
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

function paddedToAddress(padded: string | null): string | null {
  if (!padded) return null;
  return `0x${padded.slice(-40)}`;
}
