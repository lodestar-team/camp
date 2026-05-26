import { NextResponse } from "next/server";
import { ampQuery, hexCol, hexLiteral, table } from "@/lib/amp";
import { checkRateLimit } from "@/lib/ratelimit";
import { handle, ApiError } from "@/lib/errors";
import { addressParam, rangeParams, limitParam } from "@/lib/validate";
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
    if (!["all", "from", "to"].includes(direction)) {
      throw new ApiError(
        "bad_request",
        400,
        "direction must be 'all', 'from', or 'to'",
      );
    }

    const addrLit = hexLiteral(address);
    let addrFilter: string;
    if (direction === "from") addrFilter = `"from" = ${addrLit}`;
    else if (direction === "to") addrFilter = `"to" = ${addrLit}`;
    else addrFilter = `("from" = ${addrLit} OR "to" = ${addrLit})`;

    const sql = `
      SELECT
        block_num,
        tx_index,
        ${hexCol("tx_hash")} AS tx_hash,
        ${hexCol("from")} AS from_addr,
        ${hexCol("to")}   AS to_addr,
        value,
        gas_used,
        gas_price,
        status
      FROM ${table("transactions")}
      WHERE block_num BETWEEN ${range.from_block} AND ${range.to_block}
        AND ${addrFilter}
      ORDER BY block_num DESC, tx_index DESC
      LIMIT ${limit}
    `;
    const rows = await ampQuery(sql);
    const transactions = rows.map((t) => ({
      block_num: Number(t.block_num),
      tx_index: Number(t.tx_index),
      tx_hash: `0x${t.tx_hash}`,
      from: `0x${t.from_addr}`,
      to: t.to_addr ? `0x${t.to_addr}` : null,
      value: t.value,
      gas_used: Number(t.gas_used),
      gas_price: t.gas_price,
      status: Boolean(t.status),
    }));

    return NextResponse.json(
      { count: transactions.length, transactions },
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
