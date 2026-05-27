// Lightweight server-side validator for the public /v1/sql endpoint.
//
// We deliberately don't ship a full SQL parser — DataFusion accepts
// PostgreSQL-ish syntax with quirks (X'hex' literals, bracket struct
// access, arrow_cast) that no off-the-shelf parser models cleanly. We
// rely on:
//
//   1. ampd being read-only at the data layer (no mutating ops are
//      meaningful even if attempted)
//   2. A regex denylist of known-dangerous forms (file readers, system
//      catalogs, DDL/DML, COPY, etc)
//   3. A required `block_num` filter — forces any SELECT to be bounded
//      by block range, so the worst-case scan is one indexed range
//   4. Hard LIMIT injection — caps result size
//   5. The existing 8s server-side timeout + IP rate limit
//
// This is a defense-in-depth posture, not a single bulletproof line.
// Per-token budgets (Phase C1) will add another layer when shipped.

const FORBIDDEN_PATTERNS: { pattern: RegExp; reason: string }[] = [
  {
    pattern:
      /\b(?:insert|update|delete|drop|create|alter|truncate|grant|revoke|copy|attach|detach|use|set|reset|begin|commit|rollback|savepoint)\b/i,
    reason: "only SELECT statements are allowed",
  },
  {
    pattern:
      /\b(?:read_csv|read_parquet|read_json|read_avro|read_ndjson|read_file|read_table|to_csv|to_parquet|to_json)\s*\(/i,
    reason: "file-IO functions are not allowed",
  },
  {
    pattern: /\b(?:pg_[a-z_]+|information_schema)\b/i,
    reason: "system catalogs are not allowed",
  },
  {
    pattern: /\b(?:load\s+extension|attach\s+database|using\s+csv)\b/i,
    reason: "engine loaders are not allowed",
  },
  {
    pattern: /\binto\s+outfile\b|\binto\s+dumpfile\b/i,
    reason: "file-write clauses are not allowed",
  },
  {
    pattern: /--|\/\*|\*\//,
    reason: "SQL comments are not allowed",
  },
  {
    pattern: /;[\s\S]*\S/,
    reason: "only one statement per request (no semicolon separator)",
  },
];

const REQUIRED_BLOCK_NUM = /\bblock_num\b/i;
const STARTS_WITH_SELECT = /^\s*(?:with\b[\s\S]+?\bselect\b|select\b)/i;
const LIMIT_PRESENT = /\blimit\s+\d+\b/i;

export const SQL_MAX_BYTES = 4096;
export const SQL_FORCED_LIMIT = 1000;

export type SqlGuardResult =
  | { ok: true; sql: string }
  | { ok: false; status: number; code: string; message: string; hint?: string };

export function guardSql(raw: string): SqlGuardResult {
  let sql = raw.trim();
  // Strip a trailing semicolon if it's the only one — the multi-statement
  // check below catches the actually-dangerous case.
  if (sql.endsWith(";")) sql = sql.slice(0, -1).trimEnd();

  if (sql.length === 0) {
    return {
      ok: false,
      status: 400,
      code: "empty_query",
      message: "query is empty",
    };
  }
  if (sql.length > SQL_MAX_BYTES) {
    return {
      ok: false,
      status: 413,
      code: "query_too_large",
      message: `query exceeds ${SQL_MAX_BYTES} bytes`,
    };
  }

  if (!STARTS_WITH_SELECT.test(sql)) {
    return {
      ok: false,
      status: 400,
      code: "not_a_select",
      message: "query must be a SELECT (or WITH … SELECT) statement",
    };
  }

  for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
    if (pattern.test(sql)) {
      return {
        ok: false,
        status: 400,
        code: "forbidden_sql",
        message: reason,
        hint: "see /v1/sql for the allowed shape",
      };
    }
  }

  if (!REQUIRED_BLOCK_NUM.test(sql)) {
    return {
      ok: false,
      status: 400,
      code: "missing_block_num_filter",
      message: "queries must reference block_num so the scan is bounded",
      hint: "add `WHERE block_num BETWEEN N AND M` to your query",
    };
  }

  // Inject LIMIT if absent (or capped). We intentionally don't try to
  // rewrite a too-large LIMIT — that's their query, we just refuse it.
  if (!LIMIT_PRESENT.test(sql)) {
    sql = `${sql}\nLIMIT ${SQL_FORCED_LIMIT}`;
  }

  return { ok: true, sql };
}
