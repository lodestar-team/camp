import { NextResponse } from "next/server";
import { ampQuery, table, hexLiteral, hexCol } from "@/lib/amp";
import { checkRateLimit } from "@/lib/ratelimit";
import { handle, ApiError } from "@/lib/errors";
import { addressParam, topicParam, rangeParams, limitParam } from "@/lib/validate";
import { cacheHeadersFor } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET(req: Request) {
  try {
    await checkRateLimit(req);
    const url = new URL(req.url);
    const address = addressParam.parse(url.searchParams.get("address"));
    const range = rangeParams.parse({
      from_block: url.searchParams.get("from_block"),
      to_block: url.searchParams.get("to_block"),
    });
    const limit = limitParam.parse(url.searchParams.get("limit") ?? undefined);

    const topic0Raw = url.searchParams.get("topic0");
    const topic1Raw = url.searchParams.get("topic1");
    const topic2Raw = url.searchParams.get("topic2");
    const topic3Raw = url.searchParams.get("topic3");

    const filters: string[] = [
      `block_num BETWEEN ${range.from_block} AND ${range.to_block}`,
      `address = ${hexLiteral(address)}`,
    ];
    if (topic0Raw) filters.push(`topic0 = ${hexLiteral(topicParam.parse(topic0Raw))}`);
    if (topic1Raw) filters.push(`topic1 = ${hexLiteral(topicParam.parse(topic1Raw))}`);
    if (topic2Raw) filters.push(`topic2 = ${hexLiteral(topicParam.parse(topic2Raw))}`);
    if (topic3Raw) filters.push(`topic3 = ${hexLiteral(topicParam.parse(topic3Raw))}`);

    const sql = `
      SELECT
        block_num,
        log_index,
        ${hexCol("tx_hash")} AS tx_hash,
        ${hexCol("topic0")}  AS topic0,
        ${hexCol("topic1")}  AS topic1,
        ${hexCol("topic2")}  AS topic2,
        ${hexCol("topic3")}  AS topic3,
        encode(data, 'hex')  AS data
      FROM ${table("logs")}
      WHERE ${filters.join(" AND ")}
      ORDER BY block_num ASC, log_index ASC
      LIMIT ${limit}
    `.trim();

    const rows = await ampQuery(sql);
    const events = rows.map((r) => ({
      block_num: Number(r.block_num),
      log_index: Number(r.log_index),
      tx_hash: `0x${r.tx_hash}`,
      topic0: r.topic0 ? `0x${r.topic0}` : null,
      topic1: r.topic1 ? `0x${r.topic1}` : null,
      topic2: r.topic2 ? `0x${r.topic2}` : null,
      topic3: r.topic3 ? `0x${r.topic3}` : null,
      data: `0x${r.data ?? ""}`,
    }));

    const tipRows = await ampQuery(`SELECT MAX(block_num) AS tip FROM ${table("blocks")}`);
    const tipBlock = Number(tipRows[0]?.tip ?? range.to_block);

    return NextResponse.json(
      { count: events.length, events },
      { headers: cacheHeadersFor({ toBlock: range.to_block, tipBlock }) },
    );
  } catch (e) {
    if (e instanceof Error && e.name === "ZodError") {
      return handle(new ApiError("bad_request", 400, e.message));
    }
    return handle(e);
  }
}
