import { NextResponse } from "next/server";
import { ampQuery, hexCol, hexLiteral, table } from "@/lib/amp";
import { checkRateLimit } from "@/lib/ratelimit";
import { handle, ApiError } from "@/lib/errors";
import { addressParam, rangeParams, limitParam } from "@/lib/validate";
import { cacheHeadersFor } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 10;

type RouteContext = { params: Promise<{ addr: string }> };

// Which contracts did this address actually touch? Cheap query — just
// distinct `to` from transactions where from = addr. Doesn't include
// contracts whose state was affected via internal calls; those aren't
// in our table set at all.
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

    const sql = `
      SELECT
        ${hexCol(`"to"`)} AS contract,
        COUNT(*) AS tx_count,
        MIN(block_num) AS first_block,
        MAX(block_num) AS last_block
      FROM ${table("transactions")}
      WHERE block_num BETWEEN ${range.from_block} AND ${range.to_block}
        AND "from" = ${hexLiteral(address)}
        AND "to" IS NOT NULL
      GROUP BY 1
      ORDER BY tx_count DESC
      LIMIT ${limit}
    `.trim();

    const rows = await ampQuery(sql);
    const interactions = rows.map((r) => ({
      contract: `0x${r.contract}`,
      tx_count: Number(r.tx_count),
      first_block: Number(r.first_block),
      last_block: Number(r.last_block),
    }));

    return NextResponse.json(
      {
        address,
        from_block: range.from_block,
        to_block: range.to_block,
        count: interactions.length,
        interactions,
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
