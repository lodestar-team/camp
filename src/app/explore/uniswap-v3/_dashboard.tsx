"use client";

import { useEffect, useMemo, useState } from "react";

type AnyRow = Record<string, string | number | null>;
type Response = { event: string; pool: string; count: number; events: AnyRow[] };
type Status = { latest_indexed_block: number };

const POOLS = [
  {
    label: "WETH/USDC 0.05%",
    address: "0xc6962004f452be9203591991d15f6b388e09e8d0",
  },
  {
    label: "WETH/USDC.e 0.05%",
    address: "0xc31e54c7a869b9fcbecc14363cf510d1c41fa443",
  },
  {
    label: "ARB/WETH 0.05%",
    address: "0x755e5a186f0469583bd2e80d1216e02ab88ec6ca",
  },
  {
    label: "WBTC/WETH 0.05%",
    address: "0x2f5e87c9312fa29aed5c179e456625d79015299c",
  },
];

const EVENTS = ["swap", "mint", "burn"] as const;
type EventKind = (typeof EVENTS)[number];

function short(addr: string | null | undefined): string {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

async function load(
  pool: string,
  event: EventKind,
): Promise<Response | null> {
  const statusRes = await fetch("/v1/status", { cache: "no-store" });
  if (!statusRes.ok) return null;
  const { latest_indexed_block } = (await statusRes.json()) as Status;
  const from = Math.max(0, latest_indexed_block - 5000);
  const res = await fetch(
    `/v1/uniswap-v3/${event}?pool=${pool}&from_block=${from}&to_block=${latest_indexed_block}&limit=50`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  return (await res.json()) as Response;
}

export function UniswapV3Dashboard() {
  const [pool, setPool] = useState<string>(POOLS[0]!.address);
  const [customPool, setCustomPool] = useState<string>("");
  const [event, setEvent] = useState<EventKind>("swap");
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activePool = customPool || pool;

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const r = await load(activePool, event);
        if (!alive) return;
        setData(r);
        setError(r ? null : "no data");
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "load failed");
      }
    }
    tick();
    const id = setInterval(tick, 12_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [activePool, event]);

  const columns = useMemo(() => {
    if (!data || data.events.length === 0) return [];
    return Object.keys(data.events[0]!);
  }, [data]);

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
        <span className="filter-label">pool</span>
        <select
          value={customPool ? "" : pool}
          onChange={(e) => {
            setCustomPool("");
            setPool(e.target.value);
          }}
          className="select"
        >
          {POOLS.map((p) => (
            <option key={p.address} value={p.address}>
              {p.label}
            </option>
          ))}
          <option value="">— custom —</option>
        </select>
        <input
          type="text"
          placeholder="0xPoolAddress"
          value={customPool}
          onChange={(e) => setCustomPool(e.target.value.trim().toLowerCase())}
          className="input mono"
          style={{ minWidth: 360 }}
        />
        <span className="filter-label" style={{ marginLeft: 16 }}>
          event
        </span>
        <div style={{ display: "inline-flex", gap: 4 }}>
          {EVENTS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEvent(e)}
              className={`btn ${event === e ? "btn-primary" : ""}`}
              style={{ padding: "6px 14px", fontSize: 13 }}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <p className="mono" style={{ color: "var(--text-subtle)", fontSize: 12, marginBottom: 12 }}>
        GET /v1/uniswap-v3/{event}?pool={activePool || "?"}&amp;…
      </p>

      {error ? (
        <p style={{ color: "#b34a3a" }}>{error}</p>
      ) : !data ? (
        <p style={{ color: "var(--text-subtle)" }}>Loading…</p>
      ) : data.events.length === 0 ? (
        <p style={{ color: "var(--text-subtle)" }}>
          No <strong>{event}</strong> events found in the last ~5k blocks for this pool.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="data-table mono" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.events.map((row, i) => (
                <tr key={i}>
                  {columns.map((c) => {
                    const v = row[c];
                    let display: string;
                    if (v == null) display = "—";
                    else if (typeof v === "string" && /^0x[0-9a-f]{40}$/i.test(v)) display = short(v);
                    else if (typeof v === "string" && v.length > 24) display = `${v.slice(0, 10)}…`;
                    else display = String(v);
                    return <td key={c}>{display}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
