"use client";

import { useEffect, useRef, useState } from "react";

type SqlResponse = {
  count: number;
  rows: Record<string, unknown>[];
  elapsed_ms: number;
};

type SqlError = {
  error: { code: string; message: string; hint?: string };
};

type Status = { latest_indexed_block: number };

const EXAMPLES: { label: string; sql: (tip: number) => string }[] = [
  {
    label: "USDC volume per minute",
    sql: (tip) => `SELECT
  date_trunc('minute', timestamp) AS bucket,
  COUNT(*) AS transfers,
  arrow_cast(
    SUM(arrow_cast(d['value'], 'Decimal128(38, 0)')),
    'Utf8'
  ) AS volume
FROM (
  SELECT timestamp,
    (evm_decode_log(topic1, topic2, topic3, data,
      'Transfer(address indexed from, address indexed to, uint256 value)')) AS d
  FROM "_/arbitrum_one@2.0.0".logs
  WHERE block_num BETWEEN ${tip - 300} AND ${tip}
    AND address = X'af88d065e77c8cc2239327c5edb3a432268e5831'
    AND topic0  = evm_topic('Transfer(address,address,uint256)')
)
GROUP BY 1
ORDER BY 1`,
  },
  {
    label: "Hottest contracts in the last 500 blocks",
    sql: (tip) => `SELECT
  encode(arrow_cast(address, 'Binary'), 'hex') AS contract,
  COUNT(*) AS log_count
FROM "_/arbitrum_one@2.0.0".logs
WHERE block_num BETWEEN ${tip - 500} AND ${tip}
GROUP BY 1
ORDER BY log_count DESC
LIMIT 10`,
  },
  {
    label: "Uniswap V3 swaps with biggest token0 movement",
    sql: (tip) => `SELECT
  block_num,
  arrow_cast(d['amount0'], 'Utf8') AS amount0,
  arrow_cast(d['amount1'], 'Utf8') AS amount1,
  arrow_cast(d['tick'],    'Utf8') AS tick
FROM (
  SELECT block_num,
    (evm_decode_log(topic1, topic2, topic3, data,
      'Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)')) AS d
  FROM "_/arbitrum_one@2.0.0".logs
  WHERE block_num BETWEEN ${tip - 1000} AND ${tip}
    AND address = X'c6962004f452be9203591991d15f6b388e09e8d0'
    AND topic0  = evm_topic('Swap(address,address,int256,int256,uint160,uint128,int24)')
)
ORDER BY arrow_cast(d['amount0'], 'Decimal128(38, 0)') DESC
LIMIT 10`,
  },
  {
    label: "Gas stats per minute",
    sql: (tip) => `SELECT
  date_trunc('minute', timestamp) AS bucket,
  COUNT(*) AS blocks,
  AVG(gas_used) AS avg_gas,
  AVG(base_fee_per_gas) AS avg_base_fee
FROM "_/arbitrum_one@2.0.0".blocks
WHERE block_num BETWEEN ${tip - 1000} AND ${tip}
GROUP BY 1
ORDER BY 1 DESC`,
  },
];

export function SqlPlayground() {
  const [sql, setSql] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SqlResponse | null>(null);
  const [error, setError] = useState<SqlError["error"] | null>(null);
  const [tip, setTip] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch tip once for examples
  useEffect(() => {
    fetch("/v1/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((s: Status) => setTip(s.latest_indexed_block))
      .catch(() => {});
  }, []);

  // Seed initial example after tip arrives
  useEffect(() => {
    if (tip != null && sql === "") {
      setSql(EXAMPLES[0]!.sql(tip));
    }
  }, [tip, sql]);

  async function run() {
    if (running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/v1/sql", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: sql,
      });
      const body = await res.json();
      if (!res.ok) {
        setError((body as SqlError).error);
      } else {
        setResult(body as SqlResponse);
      }
    } catch (e) {
      setError({
        code: "client_error",
        message: e instanceof Error ? e.message : "request failed",
      });
    } finally {
      setRunning(false);
    }
  }

  // Cmd/Ctrl + Enter to run
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      run();
    }
  }

  const columns =
    result && result.rows.length > 0 ? Object.keys(result.rows[0]!) : [];

  return (
    <div>
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <span className="filter-label">examples</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            className="filter-chip"
            onClick={() => tip != null && setSql(ex.sql(tip))}
            disabled={tip == null}
          >
            {ex.label}
          </button>
        ))}
      </div>

      <div className="sql-editor-wrap">
        <textarea
          ref={textareaRef}
          className="sql-editor"
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          placeholder="SELECT block_num, gas_used FROM &quot;_/arbitrum_one@2.0.0&quot;.blocks WHERE block_num BETWEEN tip-100 AND tip"
          rows={14}
        />
        <div className="sql-toolbar">
          <span className="filter-label">
            <kbd className="kbd">⌘</kbd> + <kbd className="kbd">↩</kbd> to run
          </span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={run}
            disabled={running}
          >
            {running ? "running…" : "Run query"}
          </button>
        </div>
      </div>

      {error && (
        <div className="disclaimer" style={{ marginTop: 20 }}>
          <strong>{error.code}:</strong> {error.message}
          {error.hint && (
            <>
              <br />
              <span className="filter-label">hint —</span> {error.hint}
            </>
          )}
        </div>
      )}

      {result && (
        <>
          <div className="dashboard-meta" style={{ marginTop: 20 }}>
            <span>
              {result.count} rows · {result.elapsed_ms} ms server-side
            </span>
            <span>
              <a
                href={`data:application/json,${encodeURIComponent(JSON.stringify(result, null, 2))}`}
                download="camp-result.json"
              >
                download JSON →
              </a>
            </span>
          </div>
          {result.rows.length > 0 ? (
            <div
              className="chart-card"
              style={{ marginTop: 12, padding: 0, overflow: "auto" }}
            >
              <table className="ticker">
                <thead>
                  <tr>
                    {columns.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i}>
                      {columns.map((c) => (
                        <td key={c} className="mono" style={{ whiteSpace: "nowrap" }}>
                          {formatCell(row[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="disclaimer" style={{ marginTop: 12 }}>
              Query returned no rows.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v == null) return "null";
  if (typeof v === "string") {
    // Long hex strings get truncated for readability
    if (/^[0-9a-f]{40,}$/i.test(v)) return `${v.slice(0, 10)}…${v.slice(-6)}`;
    return v;
  }
  if (typeof v === "number") return v.toLocaleString();
  if (typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}
