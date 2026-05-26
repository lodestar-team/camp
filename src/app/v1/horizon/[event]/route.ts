import { NextResponse } from "next/server";
import { ampQuery, hexCol, hexLiteral, table } from "@/lib/amp";
import { checkRateLimit } from "@/lib/ratelimit";
import { handle, ApiError } from "@/lib/errors";
import { rangeParams, limitParam, addressParam } from "@/lib/validate";
import { cacheHeadersFor } from "@/lib/cache";
import {
  HORIZON_EVENT_BY_SLUG,
  HORIZON_EVENTS,
  HORIZON_STAKING_ADDRESS,
} from "@/lib/horizon";

export const runtime = "nodejs";
export const maxDuration = 10;

type RouteContext = { params: Promise<{ event: string }> };

import type { HorizonEvent } from "@/lib/horizon";

// SQL projection per field. Address/bytes32 fields are hex-encoded;
// uint/int fields are cast to Utf8 so big numbers (uint256 amounts that
// exceed JS Number.MAX_SAFE_INTEGER) survive the JSON round-trip with
// full precision.
function projectField(f: HorizonEvent["fields"][number]): string {
  const expr = `d['${f.name}']`;
  if (f.kind === "address" || f.kind === "bytes32") {
    return `${hexCol(expr)} AS "${f.name}"`;
  }
  return `arrow_cast(${expr}, 'Utf8') AS "${f.name}"`;
}

export async function GET(req: Request, ctx: RouteContext) {
  try {
    await checkRateLimit(req);
    const { event: slug } = await ctx.params;
    const event = HORIZON_EVENT_BY_SLUG.get(slug.toLowerCase());
    if (!event) {
      throw new ApiError(
        "bad_request",
        404,
        `unknown horizon event '${slug}'`,
        `valid slugs: ${HORIZON_EVENTS.map((e) => e.slug).join(", ")}`,
      );
    }

    const url = new URL(req.url);
    const range = rangeParams.parse({
      from_block: url.searchParams.get("from_block"),
      to_block: url.searchParams.get("to_block"),
    });
    const limit = limitParam.parse(url.searchParams.get("limit") ?? undefined);

    // Optional indexed filters — only the indexed address fields can be
    // filtered server-side cheaply, since they appear in topic1..topic3
    // before decoding. The other fields are inside the data payload and
    // would need post-decode filtering, which we don't bother with for
    // the v0 cut.
    const indexed = event.fields.filter(
      (f) => f.indexed && f.kind === "address",
    );
    const indexedFilters: string[] = [];
    indexed.forEach((f, i) => {
      const raw = url.searchParams.get(f.name);
      if (!raw) return;
      const addr = addressParam.parse(raw);
      // topic1 = first indexed param, topic2 = second, topic3 = third.
      const topicCol = `topic${i + 1}`;
      // Address as a 32-byte padded topic value:
      const padded = `0x${"0".repeat(24)}${addr.replace(/^0x/, "")}`;
      indexedFilters.push(`${topicCol} = ${hexLiteral(padded)}`);
    });

    const fieldsProjection = event.fields
      .map(projectField)
      .join(",\n        ");

    const sql = `
      SELECT
        block_num,
        log_index,
        ${hexCol("tx_hash")} AS tx_hash,
        ${fieldsProjection}
      FROM (
        SELECT
          block_num, log_index, tx_hash,
          (evm_decode_log(topic1, topic2, topic3, data,
            '${event.decodeSignature}')) AS d
        FROM ${table("logs")}
        WHERE block_num BETWEEN ${range.from_block} AND ${range.to_block}
          AND address = ${hexLiteral(HORIZON_STAKING_ADDRESS)}
          AND topic0  = evm_topic('${event.topicSignature}')
          ${indexedFilters.length ? " AND " + indexedFilters.join(" AND ") : ""}
      )
      ORDER BY block_num DESC, log_index DESC
      LIMIT ${limit}
    `.trim();

    const rows = await ampQuery(sql);
    const events = rows.map((r) => {
      const out: Record<string, string | number | null> = {
        block_num: Number(r.block_num),
        log_index: Number(r.log_index),
        tx_hash: `0x${r.tx_hash}`,
      };
      for (const f of event.fields) {
        const v = r[f.name];
        if (v == null) {
          out[f.name] = null;
        } else if (f.kind === "address") {
          out[f.name] = `0x${String(v).toLowerCase()}`;
        } else {
          // uint / bytes32 — leave as decimal / hex string verbatim
          out[f.name] = v as string;
        }
      }
      return out;
    });

    return NextResponse.json(
      { event: event.name, count: events.length, events },
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
