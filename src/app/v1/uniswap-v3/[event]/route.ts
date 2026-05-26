import { NextResponse } from "next/server";
import { ampQuery, hexCol, hexLiteral, table } from "@/lib/amp";
import { checkRateLimit } from "@/lib/ratelimit";
import { handle, ApiError } from "@/lib/errors";
import { rangeParams, limitParam, addressParam } from "@/lib/validate";
import { cacheHeadersFor } from "@/lib/cache";
import {
  UNISWAP_V3_EVENT_BY_SLUG,
  UNISWAP_V3_EVENTS,
} from "@/lib/uniswap-v3";

export const runtime = "nodejs";
export const maxDuration = 10;

type RouteContext = { params: Promise<{ event: string }> };

export async function GET(req: Request, ctx: RouteContext) {
  try {
    await checkRateLimit(req);
    const { event: slug } = await ctx.params;
    const event = UNISWAP_V3_EVENT_BY_SLUG.get(slug.toLowerCase());
    if (!event) {
      throw new ApiError(
        "bad_request",
        404,
        `unknown uniswap-v3 event '${slug}'`,
        `valid slugs: ${UNISWAP_V3_EVENTS.map((e) => e.slug).join(", ")}`,
      );
    }

    const url = new URL(req.url);
    const poolRaw = url.searchParams.get("pool");
    if (!poolRaw) {
      throw new ApiError(
        "bad_request",
        400,
        "missing required query param: pool",
        "pass ?pool=0x… (the V3 pool contract address)",
      );
    }
    const pool = addressParam.parse(poolRaw);
    const range = rangeParams.parse({
      from_block: url.searchParams.get("from_block"),
      to_block: url.searchParams.get("to_block"),
    });
    const limit = limitParam.parse(url.searchParams.get("limit") ?? undefined);

    // Optional indexed-address filters by field name. Topic positions are
    // derived from the order of the indexed fields in the event definition
    // (topic1, topic2, topic3 for the 1st/2nd/3rd indexed param). Note we
    // skip non-address indexed fields when picking topic numbers because
    // their on-wire encoding isn't simply zero-padded — we'd need int24
    // two's-complement handling, not worth shipping for v0.
    const indexedAddresses = event.fields
      .map((f, i) => ({ field: f, position: i }))
      .filter((p) => p.field.indexed && p.field.kind === "address");

    // Determine which topic number each indexed-address field maps to —
    // count ALL preceding indexed fields, not just addresses.
    const topicOf: Record<string, string> = {};
    {
      let topicCounter = 1;
      for (const f of event.fields) {
        if (!f.indexed) continue;
        if (f.kind === "address") topicOf[f.name] = `topic${topicCounter}`;
        topicCounter++;
      }
    }
    const indexedFilters: string[] = [];
    for (const { field } of indexedAddresses) {
      const raw = url.searchParams.get(field.name);
      if (!raw) continue;
      const addr = addressParam.parse(raw);
      const padded = `0x${"0".repeat(24)}${addr.replace(/^0x/, "")}`;
      indexedFilters.push(`${topicOf[field.name]} = ${hexLiteral(padded)}`);
    }

    // Cast numeric fields (uint/int) to Utf8 so they survive the JSON
    // round-trip without JS Number precision loss. Address fields come
    // out as binary and get the hex-encode treatment instead.
    const projection = event.fields
      .map((f) => {
        const expr = `d['${f.name}']`;
        if (f.kind === "address") {
          return `${hexCol(expr)} AS "${f.name}"`;
        }
        if (f.kind === "bytes32") {
          return `${hexCol(expr)} AS "${f.name}"`;
        }
        // uint / int → decimal string
        return `arrow_cast(${expr}, 'Utf8') AS "${f.name}"`;
      })
      .join(",\n        ");

    const sql = `
      SELECT
        block_num,
        log_index,
        ${hexCol("tx_hash")} AS tx_hash,
        ${projection}
      FROM (
        SELECT
          block_num, log_index, tx_hash,
          (evm_decode_log(topic1, topic2, topic3, data,
            '${event.decodeSignature}')) AS d
        FROM ${table("logs")}
        WHERE block_num BETWEEN ${range.from_block} AND ${range.to_block}
          AND address = ${hexLiteral(pool)}
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
        if (v == null) out[f.name] = null;
        else if (f.kind === "address")
          out[f.name] = `0x${String(v).toLowerCase()}`;
        else out[f.name] = v as string; // uint/int as decimal string, bytes32 as hex
      }
      return out;
    });

    return NextResponse.json(
      { event: event.name, pool, count: events.length, events },
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
