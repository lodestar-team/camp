"use client";

import { useEffect, useMemo, useState } from "react";

type Transfer = {
  block_num: number;
  log_index: number;
  tx_hash: string;
  from: string;
  to: string;
  value: string;
};

type WhalesResponse = {
  token: string;
  min_value: string;
  count: number;
  transfers: Transfer[];
};

type Status = { latest_indexed_block: number };

const TOKENS: Record<string, { symbol: string; address: string; decimals: number; defaultMin: string }> = {
  USDC: {
    symbol: "USDC",
    address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
    decimals: 6,
    defaultMin: "10000000000", // $10K
  },
  WETH: {
    symbol: "WETH",
    address: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    decimals: 18,
    defaultMin: "5000000000000000000", // 5 ETH
  },
  USDT: {
    symbol: "USDT",
    address: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
    decimals: 6,
    defaultMin: "10000000000",
  },
};

function fmt(value: string, decimals: number, symbol: string): string {
  try {
    const v = BigInt(value);
    const div = 10n ** BigInt(decimals);
    const whole = v / div;
    const frac = v % div;
    const wholeStr = whole.toString();
    // Show 2 decimals for stablecoins, 4 for WETH
    const decimalsShown = decimals === 18 ? 4 : 2;
    if (decimalsShown === 0) return `${wholeStr} ${symbol}`;
    const fracStr = frac.toString().padStart(decimals, "0").slice(0, decimalsShown);
    // Add thousands separator
    const wholeWithCommas = wholeStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${wholeWithCommas}.${fracStr} ${symbol}`;
  } catch {
    return value;
  }
}

function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

async function load(token: keyof typeof TOKENS, minValue: string): Promise<WhalesResponse | null> {
  const statusRes = await fetch("/v1/status", { cache: "no-store" });
  if (!statusRes.ok) return null;
  const { latest_indexed_block } = (await statusRes.json()) as Status;
  // 5 min of chain time ≈ 1200 blocks. The reindex window is small so
  // wider isn't free — we cap at our 100k block span max anyway.
  const from = Math.max(0, latest_indexed_block - 1200);
  const t = TOKENS[token]!;
  const res = await fetch(
    `/v1/whales/transfers?token=${t.address}&from_block=${from}&to_block=${latest_indexed_block}&min_value=${minValue}&limit=50`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  return (await res.json()) as WhalesResponse;
}

export function WhalesDashboard() {
  const [token, setToken] = useState<keyof typeof TOKENS>("USDC");
  const [minValue, setMinValue] = useState<string>(TOKENS.USDC!.defaultMin);
  const [data, setData] = useState<WhalesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // When token switches, snap min_value back to that token's default
  useEffect(() => {
    setMinValue(TOKENS[token]!.defaultMin);
  }, [token]);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const r = await load(token, minValue);
        if (alive) {
          setData(r);
          setError(r ? null : "no data");
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "load failed");
      }
    }
    tick();
    const id = setInterval(tick, 10_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [token, minValue]);

  const t = TOKENS[token]!;
  const totalMoved = useMemo(() => {
    if (!data) return null;
    return data.transfers.reduce((acc, x) => acc + BigInt(x.value), 0n).toString();
  }, [data]);

  return (
    <div>
      <div className="filter-bar">
        <div className="filter-group">
          <span className="filter-label">token</span>
          {Object.keys(TOKENS).map((k) => (
            <button
              key={k}
              type="button"
              className={`filter-chip${k === token ? " active" : ""}`}
              onClick={() => setToken(k as keyof typeof TOKENS)}
            >
              {k}
            </button>
          ))}
        </div>
        <div className="filter-group">
          <span className="filter-label">min</span>
          <input
            type="text"
            className="filter-input"
            value={minValue}
            onChange={(e) => setMinValue(e.target.value.replace(/\D/g, ""))}
            spellCheck={false}
          />
          <span className="filter-label" style={{ opacity: 0.6 }}>
            base units · ≈ {fmt(minValue, t.decimals, t.symbol)}
          </span>
        </div>
      </div>

      <div className="stat-row" style={{ marginTop: 24 }}>
        <div className="stat">
          <div className="stat-label">whales in window</div>
          <div className="stat-value mono">
            {data?.count ?? "—"}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">total moved</div>
          <div className="stat-value mono" style={{ fontSize: 22 }}>
            {totalMoved ? fmt(totalMoved, t.decimals, t.symbol) : "—"}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">window</div>
          <div className="stat-value mono" style={{ fontSize: 22 }}>
            ≈ 5 min
          </div>
        </div>
      </div>

      {error ? (
        <div className="disclaimer" style={{ marginTop: 20 }}>
          load error: <code>{error}</code>
        </div>
      ) : !data || data.transfers.length === 0 ? (
        <div className="disclaimer" style={{ marginTop: 20 }}>
          No whales above this threshold in the last ~5 minutes. Try lowering{" "}
          <code>min</code>, or switch tokens.
        </div>
      ) : (
        <div className="chart-card" style={{ marginTop: 20, padding: 0, overflow: "hidden" }}>
          <table className="ticker">
            <thead>
              <tr>
                <th>block</th>
                <th>from</th>
                <th>to</th>
                <th style={{ textAlign: "right" }}>amount</th>
                <th>tx</th>
              </tr>
            </thead>
            <tbody>
              {data.transfers.map((tr) => (
                <tr key={`${tr.block_num}-${tr.log_index}`}>
                  <td className="mono">{tr.block_num.toLocaleString()}</td>
                  <td className="mono">{short(tr.from)}</td>
                  <td className="mono">{short(tr.to)}</td>
                  <td className="mono" style={{ textAlign: "right" }}>
                    {fmt(tr.value, t.decimals, t.symbol)}
                  </td>
                  <td>
                    <a
                      className="mono"
                      href={`https://arbiscan.io/tx/${tr.tx_hash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {tr.tx_hash.slice(0, 10)}↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="dashboard-meta">
        <span>{data?.count ?? 0} matches · refreshes every 10 s</span>
        <span>5-minute window from chain tip</span>
        <a
          href={`/v1/whales/transfers?token=${t.address}&min_value=${minValue}&from_block=${(data?.transfers[0]?.block_num ?? 0) - 1000}&to_block=${data?.transfers[0]?.block_num ?? 0}`}
          target="_blank"
          rel="noreferrer"
        >
          view raw response →
        </a>
      </div>
    </div>
  );
}
