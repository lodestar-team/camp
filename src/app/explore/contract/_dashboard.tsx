"use client";

import { useEffect, useMemo, useState } from "react";

type Status = { latest_indexed_block: number };
type SeriesPoint = { ts: string; logs: number };
type ActivityRes = { address: string; bucket: string; count: number; series: SeriesPoint[] };

const EXAMPLES = [
  { label: "USDC (Arb-native)", addr: "0xaf88d065e77c8cc2239327c5edb3a432268e5831" },
  { label: "Uniswap V3 Factory", addr: "0x1f98431c8ad98523631ae4a59f267346ea31f984" },
  { label: "GMX Vault", addr: "0x489ee077994b6658eafa855c308275ead8097c4a" },
];
const BUCKETS = ["minute", "hour", "day"] as const;
type Bucket = (typeof BUCKETS)[number];

function isAddress(s: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(s);
}

export function ContractDashboard() {
  const [addrInput, setAddrInput] = useState<string>(EXAMPLES[0]!.addr);
  const [bucket, setBucket] = useState<Bucket>("minute");
  const [data, setData] = useState<ActivityRes | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAddress(addrInput)) {
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
        const span = bucket === "minute" ? 5_000 : 100_000;
        const from = Math.max(0, latest_indexed_block - span);
        const res = await fetch(
          `/v1/contract/${addrInput}/activity?from_block=${from}&to_block=${latest_indexed_block}&bucket=${bucket}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          if (alive) setError(`status ${res.status}`);
          return;
        }
        const json = (await res.json()) as ActivityRes;
        if (alive) {
          setData(json);
          setError(null);
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
  }, [addrInput, bucket]);

  const max = useMemo(() => {
    if (!data || data.series.length === 0) return 0;
    return data.series.reduce((acc, p) => (p.logs > acc ? p.logs : acc), 0);
  }, [data]);
  const total = useMemo(
    () => (data ? data.series.reduce((acc, p) => acc + p.logs, 0) : 0),
    [data],
  );

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
        <span className="filter-label">contract</span>
        <select
          value={EXAMPLES.find((e) => e.addr === addrInput) ? addrInput : ""}
          onChange={(e) => e.target.value && setAddrInput(e.target.value)}
          className="select"
        >
          {EXAMPLES.map((e) => (
            <option key={e.addr} value={e.addr}>
              {e.label}
            </option>
          ))}
          <option value="">— custom —</option>
        </select>
        <input
          type="text"
          placeholder="0x…"
          value={addrInput}
          onChange={(e) => setAddrInput(e.target.value.trim().toLowerCase())}
          className="input mono"
          style={{ minWidth: 360 }}
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
      ) : !data ? (
        <p style={{ color: "var(--text-subtle)" }}>Loading…</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 24, marginBottom: 16, color: "var(--text-muted)" }}>
            <div>
              <p className="filter-label">buckets</p>
              <p className="mono" style={{ fontSize: 18 }}>{data.count}</p>
            </div>
            <div>
              <p className="filter-label">total logs</p>
              <p className="mono" style={{ fontSize: 18 }}>{total.toLocaleString()}</p>
            </div>
            <div>
              <p className="filter-label">peak bucket</p>
              <p className="mono" style={{ fontSize: 18 }}>{max.toLocaleString()}</p>
            </div>
          </div>

          {data.series.length === 0 ? (
            <p style={{ color: "var(--text-subtle)" }}>
              No logs emitted in this window. Try a wider bucket.
            </p>
          ) : (
            <div className="bars">
              {data.series.map((p) => {
                const pct = max > 0 ? (p.logs / max) * 100 : 0;
                return (
                  <div key={p.ts} className="bar-col" title={`${p.ts} · ${p.logs.toLocaleString()} logs`}>
                    <div className="bar" style={{ height: `${pct}%` }} />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}
