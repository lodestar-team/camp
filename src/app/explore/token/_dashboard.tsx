"use client";

import { useEffect, useMemo, useState } from "react";

type Status = { latest_indexed_block: number };
type SeriesPoint = { ts: string; transfers: number; volume: string };
type VolumeRes = { token: string; bucket: string; count: number; series: SeriesPoint[] };
type Transfer = {
  block_num: number;
  log_index: number;
  tx_hash: string;
  from: string;
  to: string;
  value: string;
};
type TransfersRes = { count: number; transfers: Transfer[] };

const TOKENS = [
  { sym: "USDC", addr: "0xaf88d065e77c8cc2239327c5edb3a432268e5831", decimals: 6 },
  { sym: "USDT", addr: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", decimals: 6 },
  { sym: "WETH", addr: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", decimals: 18 },
  { sym: "ARB", addr: "0x912ce59144191c1204e64559fe8253a0e49e6548", decimals: 18 },
];
const BUCKETS = ["minute", "hour", "day"] as const;
type Bucket = (typeof BUCKETS)[number];

function isAddress(s: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(s);
}

function fmtAmount(value: string, decimals: number): string {
  try {
    const v = BigInt(value);
    const div = 10n ** BigInt(decimals);
    const whole = v / div;
    const fracPart = v % div;
    const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const decimalsShown = decimals === 18 ? 4 : 2;
    const fracStr = fracPart.toString().padStart(decimals, "0").slice(0, decimalsShown);
    return `${wholeStr}.${fracStr}`;
  } catch {
    return value;
  }
}

function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function TokenDashboard() {
  const [tokenInput, setTokenInput] = useState<string>(TOKENS[0]!.addr);
  const [decimals, setDecimals] = useState<number>(TOKENS[0]!.decimals);
  const [bucket, setBucket] = useState<Bucket>("minute");
  const [volume, setVolume] = useState<VolumeRes | null>(null);
  const [transfers, setTransfers] = useState<TransfersRes | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAddress(tokenInput)) {
      setError("Not a valid address");
      return;
    }
    setError(null);
    let alive = true;

    async function tick() {
      try {
        const statusRes = await fetch("/v1/status", { cache: "no-store" });
        if (!statusRes.ok) return;
        const { latest_indexed_block } = (await statusRes.json()) as Status;
        const span = bucket === "minute" ? 5_000 : bucket === "hour" ? 100_000 : 100_000;
        const from = Math.max(0, latest_indexed_block - span);
        const [v, t] = await Promise.all([
          fetch(
            `/v1/token/${tokenInput}/volume?from_block=${from}&to_block=${latest_indexed_block}&bucket=${bucket}`,
            { cache: "no-store" },
          ).then((r) => (r.ok ? (r.json() as Promise<VolumeRes>) : null)),
          fetch(
            `/v1/transfers?token=${tokenInput}&from_block=${Math.max(
              0,
              latest_indexed_block - 1200,
            )}&to_block=${latest_indexed_block}&limit=30`,
            { cache: "no-store" },
          ).then((r) => (r.ok ? (r.json() as Promise<TransfersRes>) : null)),
        ]);
        if (alive) {
          setVolume(v);
          setTransfers(t);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "load failed");
      }
    }

    tick();
    const id = setInterval(tick, 15_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [tokenInput, bucket]);

  const max = useMemo(() => {
    if (!volume || volume.series.length === 0) return 0n;
    return volume.series.reduce((acc, p) => {
      const v = BigInt(p.volume);
      return v > acc ? v : acc;
    }, 0n);
  }, [volume]);

  const totals = useMemo(() => {
    if (!volume) return { transfers: 0, volume: 0n };
    return volume.series.reduce(
      (acc, p) => ({
        transfers: acc.transfers + p.transfers,
        volume: acc.volume + BigInt(p.volume),
      }),
      { transfers: 0, volume: 0n },
    );
  }, [volume]);

  return (
    <>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <span className="filter-label">token</span>
        <select
          value={TOKENS.find((t) => t.addr === tokenInput) ? tokenInput : ""}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            setTokenInput(v);
            const m = TOKENS.find((t) => t.addr === v);
            if (m) setDecimals(m.decimals);
          }}
          className="select"
        >
          {TOKENS.map((t) => (
            <option key={t.addr} value={t.addr}>
              {t.sym}
            </option>
          ))}
          <option value="">— custom —</option>
        </select>
        <input
          type="text"
          placeholder="0xToken"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value.trim().toLowerCase())}
          className="input mono"
          style={{ minWidth: 360 }}
        />
        <input
          type="number"
          min={0}
          max={36}
          value={decimals}
          onChange={(e) => setDecimals(Number(e.target.value))}
          className="input mono"
          style={{ width: 70 }}
          title="decimals"
        />
        <span className="filter-label" style={{ marginLeft: 16 }}>
          bucket
        </span>
        {BUCKETS.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBucket(b)}
            className={`filter-chip ${bucket === b ? "active" : ""}`}
          >
            {b}
          </button>
        ))}
      </div>

      {error ? (
        <p style={{ color: "#b34a3a" }}>{error}</p>
      ) : !volume ? (
        <p style={{ color: "var(--text-subtle)" }}>Loading…</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 24, marginBottom: 16, color: "var(--text-muted)" }}>
            <div>
              <p className="filter-label">buckets</p>
              <p className="mono" style={{ fontSize: 18 }}>{volume.count}</p>
            </div>
            <div>
              <p className="filter-label">transfers</p>
              <p className="mono" style={{ fontSize: 18 }}>{totals.transfers.toLocaleString()}</p>
            </div>
            <div>
              <p className="filter-label">volume</p>
              <p className="mono" style={{ fontSize: 18 }}>
                {fmtAmount(totals.volume.toString(), decimals)}
              </p>
            </div>
          </div>

          {volume.series.length === 0 ? (
            <p style={{ color: "var(--text-subtle)" }}>
              No transfers in this window. Try a wider bucket.
            </p>
          ) : (
            <div className="bars">
              {volume.series.map((p) => {
                const v = BigInt(p.volume);
                const pct = max > 0n ? Number((v * 1000n) / max) / 10 : 0;
                return (
                  <div key={p.ts} className="bar-col" title={`${p.ts} · ${p.transfers} transfers · ${fmtAmount(p.volume, decimals)}`}>
                    <div className="bar" style={{ height: `${pct}%` }} />
                  </div>
                );
              })}
            </div>
          )}

          <p
            className="mono"
            style={{ marginTop: 24, marginBottom: 12, color: "var(--text-subtle)", fontSize: 12 }}
          >
            Recent transfers (last ~5 min):
          </p>
          {!transfers || transfers.transfers.length === 0 ? (
            <p style={{ color: "var(--text-subtle)" }}>Nothing in window.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table mono" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>block</th>
                    <th>from</th>
                    <th>to</th>
                    <th>value</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.transfers.map((r, i) => (
                    <tr key={`${r.block_num}-${r.log_index}-${i}`}>
                      <td>{r.block_num.toLocaleString()}</td>
                      <td>{short(r.from)}</td>
                      <td>{short(r.to)}</td>
                      <td>{fmtAmount(r.value, decimals)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
