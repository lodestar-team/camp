"use client";

import { useEffect, useMemo, useState } from "react";

type AnyRow = Record<string, string | number | null>;
type Response = { event: string; pool: string; count: number; events: AnyRow[] };
type Status = { latest_indexed_block: number };

type PoolMeta = {
  label: string;
  address: string;
  token0: { symbol: string; decimals: number };
  token1: { symbol: string; decimals: number };
  feeBps: number;
};

// token0 / token1 are determined by address ordering. WETH (0x82af…) <
// USDC (0xaf88…), so on WETH/USDC pools WETH is token0 and USDC is token1.
const POOLS: PoolMeta[] = [
  {
    label: "WETH/USDC 0.05%",
    address: "0xc6962004f452be9203591991d15f6b388e09e8d0",
    token0: { symbol: "WETH", decimals: 18 },
    token1: { symbol: "USDC", decimals: 6 },
    feeBps: 5,
  },
  {
    label: "WETH/USDC.e 0.05%",
    address: "0xc31e54c7a869b9fcbecc14363cf510d1c41fa443",
    token0: { symbol: "WETH", decimals: 18 },
    token1: { symbol: "USDC.e", decimals: 6 },
    feeBps: 5,
  },
  {
    label: "ARB/WETH 0.05%",
    address: "0x755e5a186f0469583bd2e80d1216e02ab88ec6ca",
    token0: { symbol: "ARB", decimals: 18 },
    token1: { symbol: "WETH", decimals: 18 },
    feeBps: 5,
  },
  {
    label: "WBTC/WETH 0.05%",
    address: "0x2f5e87c9312fa29aed5c179e456625d79015299c",
    token0: { symbol: "WBTC", decimals: 8 },
    token1: { symbol: "WETH", decimals: 18 },
    feeBps: 5,
  },
];

const EVENTS = ["swap", "mint", "burn"] as const;
type EventKind = (typeof EVENTS)[number];

function short(addr: string | null | undefined): string {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// Format a uint/int decimal-string with the right number of fractional
// places. Handles negative values too.
function formatDecimal(raw: string, decimals: number, places = 4): string {
  let neg = false;
  let s = raw;
  if (s.startsWith("-")) {
    neg = true;
    s = s.slice(1);
  }
  if (s.length <= decimals) s = s.padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals);
  const frac = s.slice(s.length - decimals).slice(0, places);
  const wholeFmt = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const out = places > 0 ? `${wholeFmt}.${frac.padEnd(places, "0")}` : wholeFmt;
  return neg ? `-${out}` : out;
}

// Implied price = |amount1| / |amount0|, adjusted for the difference in
// decimals. Returns a string formatted with thousands separators and 4
// fractional places.
function impliedPrice(amount0: string, amount1: string, pool: PoolMeta): string | null {
  try {
    const a0 = BigInt(amount0);
    const a1 = BigInt(amount1);
    if (a0 === 0n) return null;
    // Use a high-precision scaled integer divide
    const SCALE = 10n ** 12n;
    const a0Abs = a0 < 0n ? -a0 : a0;
    const a1Abs = a1 < 0n ? -a1 : a1;
    // price (token1 per token0), in token1's smallest unit per token0's smallest unit
    // → multiply by SCALE for fractional precision, divide
    const ratio = (a1Abs * SCALE) / a0Abs;
    // Adjust for decimal difference: result so far is in
    // (token1_smallest_units * SCALE) per (token0_smallest_unit). To get
    // token1 per token0 in normal units, multiply by 10^token0Dec and
    // divide by 10^token1Dec.
    const adj = (ratio * 10n ** BigInt(pool.token0.decimals)) / 10n ** BigInt(pool.token1.decimals);
    // adj is price × SCALE. Format with 4 fractional places.
    const wholeUnits = adj / SCALE;
    const fracUnits = adj % SCALE;
    const fracStr = fracUnits.toString().padStart(12, "0").slice(0, 4);
    return `${wholeUnits.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fracStr}`;
  } catch {
    return null;
  }
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
  const poolMeta = useMemo(
    () => POOLS.find((p) => p.address === activePool) ?? null,
    [activePool],
  );

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

      {!poolMeta ? (
        <p style={{ color: "var(--text-subtle)", fontSize: 12, marginBottom: 12 }}>
          Unknown pool — showing raw integers without decimal adjustment.
        </p>
      ) : null}

      {error ? (
        <p style={{ color: "#b34a3a" }}>{error}</p>
      ) : !data ? (
        <p style={{ color: "var(--text-subtle)" }}>Loading…</p>
      ) : data.events.length === 0 ? (
        <p style={{ color: "var(--text-subtle)" }}>
          No <strong>{event}</strong> events found in the last ~5k blocks for this pool.
        </p>
      ) : event === "swap" && poolMeta ? (
        <SwapTable rows={data.events} pool={poolMeta} />
      ) : event === "mint" && poolMeta ? (
        <MintBurnTable rows={data.events} pool={poolMeta} kind="mint" />
      ) : event === "burn" && poolMeta ? (
        <MintBurnTable rows={data.events} pool={poolMeta} kind="burn" />
      ) : (
        <RawTable rows={data.events} />
      )}
    </>
  );
}

function SwapTable({ rows, pool }: { rows: AnyRow[]; pool: PoolMeta }) {
  const t0 = pool.token0;
  const t1 = pool.token1;
  return (
    <div className="table-wrap">
      <table className="data-table mono" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>block</th>
            <th>tx</th>
            <th>sender</th>
            <th>recipient</th>
            <th>{t0.symbol} Δ</th>
            <th>{t1.symbol} Δ</th>
            <th>price ({t1.symbol}/{t0.symbol})</th>
            <th>tick</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const a0 = String(r.amount0 ?? "0");
            const a1 = String(r.amount1 ?? "0");
            const price = impliedPrice(a0, a1, pool);
            return (
              <tr key={i}>
                <td>{Number(r.block_num).toLocaleString()}</td>
                <td>{short(r.tx_hash as string)}</td>
                <td>{short(r.sender as string)}</td>
                <td>{short(r.recipient as string)}</td>
                <td style={{ color: a0.startsWith("-") ? "#b34a3a" : "var(--text)" }}>
                  {formatDecimal(a0, t0.decimals)}
                </td>
                <td style={{ color: a1.startsWith("-") ? "#b34a3a" : "var(--text)" }}>
                  {formatDecimal(a1, t1.decimals)}
                </td>
                <td>{price ?? "—"}</td>
                <td>{String(r.tick ?? "—")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MintBurnTable({
  rows,
  pool,
  kind,
}: {
  rows: AnyRow[];
  pool: PoolMeta;
  kind: "mint" | "burn";
}) {
  const t0 = pool.token0;
  const t1 = pool.token1;
  const ownerKey = kind === "mint" ? "owner" : "owner";
  return (
    <div className="table-wrap">
      <table className="data-table mono" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>block</th>
            <th>tx</th>
            <th>{ownerKey}</th>
            <th>tickLower</th>
            <th>tickUpper</th>
            <th>{t0.symbol}</th>
            <th>{t1.symbol}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const a0 = String(r.amount0 ?? "0");
            const a1 = String(r.amount1 ?? "0");
            return (
              <tr key={i}>
                <td>{Number(r.block_num).toLocaleString()}</td>
                <td>{short(r.tx_hash as string)}</td>
                <td>{short((r.owner ?? r.sender) as string)}</td>
                <td>{String(r.tickLower ?? "—")}</td>
                <td>{String(r.tickUpper ?? "—")}</td>
                <td>{formatDecimal(a0, t0.decimals)}</td>
                <td>{formatDecimal(a1, t1.decimals)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RawTable({ rows }: { rows: AnyRow[] }) {
  const columns = Object.keys(rows[0]!);
  return (
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
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => {
                const v = row[c];
                let display: string;
                if (v == null) display = "—";
                else if (typeof v === "string" && /^0x[0-9a-f]{40}$/i.test(v)) display = short(v);
                else if (typeof v === "string" && v.length > 20) display = `${v.slice(0, 10)}…`;
                else display = String(v);
                return <td key={c}>{display}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
