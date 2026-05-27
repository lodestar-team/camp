import { NextResponse } from "next/server";
import { ampQuery } from "@/lib/amp";
import { checkRateLimit } from "@/lib/ratelimit";
import { handle, ApiError } from "@/lib/errors";
import { guardSql, SQL_MAX_BYTES, SQL_FORCED_LIMIT } from "@/lib/sql-guard";

export const runtime = "nodejs";
export const maxDuration = 10;

// GET = small "how to use this" payload
export async function GET() {
  return NextResponse.json({
    endpoint: "/v1/sql",
    method: "POST",
    body: {
      shape: { query: "SELECT ..." },
      alternative: "raw text/plain SQL body works too",
    },
    contract: {
      max_query_bytes: SQL_MAX_BYTES,
      forced_limit: SQL_FORCED_LIMIT,
      timeout_ms: 8000,
      requires: "every query must reference block_num in the WHERE clause",
      forbidden:
        "SQL comments, multiple statements, DDL/DML, file-IO functions, system catalogs",
    },
    available_tables: [
      `_/arbitrum_one@2.0.0.blocks`,
      `_/arbitrum_one@2.0.0.transactions`,
      `_/arbitrum_one@2.0.0.logs`,
    ],
    udfs: [
      "evm_decode_log(topic1, topic2, topic3, data, signature)",
      "evm_topic(signature)",
      "evm_decode_params(input, signature)",
      "evm_encode_params(args..., signature)",
      "evm_decode_type(data, type)",
      "evm_encode_type(value, type)",
    ],
    example: `SELECT date_trunc('minute', timestamp) AS bucket,
       COUNT(*) AS swaps
FROM "_/arbitrum_one@2.0.0".logs
WHERE block_num BETWEEN 466940000 AND 466960000
  AND topic0 = evm_topic('Swap(address,address,int256,int256,uint160,uint128,int24)')
GROUP BY 1
ORDER BY 1`,
  });
}

export async function POST(req: Request) {
  try {
    await checkRateLimit(req);

    const contentType = req.headers.get("content-type") ?? "";
    let raw: string;
    if (contentType.includes("application/json")) {
      const body = (await req.json().catch(() => null)) as { query?: unknown } | null;
      const q = body?.query;
      if (typeof q !== "string") {
        throw new ApiError(
          "bad_request",
          400,
          "JSON body must include { query: '...' }",
        );
      }
      raw = q;
    } else {
      raw = await req.text();
    }

    const guard = guardSql(raw);
    if (!guard.ok) {
      return handle(
        new ApiError(
          guard.code === "missing_block_num_filter" ? "bad_request" : "bad_request",
          guard.status,
          guard.message,
          guard.hint,
        ),
      );
    }

    const started = Date.now();
    const rows = await ampQuery(guard.sql);
    return NextResponse.json(
      {
        count: rows.length,
        rows,
        elapsed_ms: Date.now() - started,
      },
      {
        // SQL responses can be arbitrary — no good edge-cache key, treat
        // as fresh per request.
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (e) {
    return handle(e);
  }
}
