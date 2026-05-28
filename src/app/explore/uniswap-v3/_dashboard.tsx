"use client";

import { useEffect, useState } from "react";

type Status = { latest_indexed_block: number };

type SwapRow = {
  block_num: number;
  log_index: number;
  tx_hash: string;
  sender: string;
  recipient: string;
  amount0: string;
  amount1: string;
  sqrtPriceX96: string;
  liquidity: string;
  tick: string;
};

type MintBurnRow = {
  block_num: number;
  log_index: number;
  tx_hash: string;
  sender?: string;
  owner: string;
  tickLower: string;
  tickUpper: string;
  amount: string;
  amount0: string;
  amount1: string;
};

type UniswapResponse = {
  event: string;
  pool: string;
  count: number;
  events: (SwapRow | MintBurnRow)[];
};

type Token = { symbol: string; decimals: number };
type Pool = { label: string; address: string; token0: Token; token1: Token };

const POOLS: Pool[] = [
  {
    label: "WETH/USDC 0.05%",
    address: "0xc6962004f452be9203591991d15f6b388e09e8d0",
    token0: { symbol: "WETH", decimals: 18 },
    token1: { symbol: "USDC", decimals: 6 },
  },
  {
    label: "WETH/USDC.e 0.05%",
    address: "0xc31e54c7a869b9fcbecc14363cf510d1c41fa443",
    token0: { symbol: "WETH", decimals: 18 },
    token1: { symbol: "USDC.e", decimals: 6 },
  },
  {
    label: "ARB/WETH 0.05%",
    address: "0x755e5a186f0469583bd2e80d1216e02ab88ec6ca",
    token0: { symbol: "ARB", decimals: 18 },
    token1: { symbol: "WETH", decimals: 18 },
  },
  {
    label: "WBTC/WETH 0.05%",
    address: "0x2f5e87c9312fa29aed5c179e456625d79015299c",
    token0: { symbol: "WBTC", decimals: 8 },
    token1: { symbol: "WETH", decimals: 18 },
  },
];

const EVENTS = ["swap", "mint", "burn"] as const;
type EventSlug = (typeof EVENTS)[number];

// How many fractional digits to show for a given token decimal count.
function dispDec(tokenDecimals: number): number {
  return tokenDecimals <= 6 ? 4 : 6;
}

// Format a signed raw-integer string to human-readable decimal.
// Pads with leading zeros so the decimal point lands correctly, then
// rounds (half-up) at `show` fractional digits.
function fmtAmt(raw: string, tokenDecimals: number, show = 6): string {
  try {
    let neg = false;
    let s = raw;
    if (s.startsWith("-")) {
      neg = true;
      s = s.slice(1);
    }
    // Ensure enough digits for the decimal point to land inside the string
    while (s.length <= tokenDecimals) s = "0" + s;
    const whole = s.slice(0, s.length - tokenDecimals) || "0";
    const fracFull = s.slice(s.length - tokenDecimals);
    const frac = show > 0 ? roundHalf(fracFull, show) : "";
    const wholeFmt = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const out = show > 0 ? `${wholeFmt}.${frac}` : wholeFmt;
    return neg ? `-${out}` : out;
  } catch {
    return raw;
  }
}

function roundHalf(digits: string, keep: number): string {
  const d = digits.padEnd(keep + 1, "0").split("").map(Number);
  if ((d[keep] ?? 0) >= 5) {
    for (let i = keep - 1; i >= 0; i--) {
      d[i] = (d[i] ?? 0) + 1;
      if ((d[i] ?? 0) < 10) break;
      d[i] = 0;
    }
  }
  return d.slice(0, keep).join("").padStart(keep, "0");
}

// Price of token0 in token1 (human-readable), computed from swap amounts.
//
// Fixed: accumulate ALL scale factors before the single integer division.
// The old formula did  (|a1| × 10¹² / |a0|) × 10^dec0 / 10^dec1  which
// fires BigInt integer division at step 2 and loses all decimal precision —
// causing every price to display as an exact whole number (2048.0000 etc).
//
// Correct: num = |a1| × 10^dec0 × 10^FRAC
//          den = |a0| × 10^dec1
//          p   = num / den          ← single division, full precision
function calcPrice(amount0: string, amount1: string, pool: Pool): string | null {
  try {
    const a0 = BigInt(amount0);
    const a1 = BigInt(amount1);
    if (a0 === 0n) return null;
    const abs0 = a0 < 0n ? -a0 : a0;
    const abs1 = a1 < 0n ? -a1 : a1;
    const FRAC = 4n;
    const num = abs1 * 10n ** BigInt(pool.token0.decimals) * 10n ** FRAC;
    const den = abs0 * 10n ** BigInt(pool.token1.decimals);
    const p = num / den;
    const whole = p / 10n ** FRAC;
    const frac = p % 10n ** FRAC;
    return `${whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${frac
      .toString()
      .padStart(Number(FRAC), "0")}`;
  } catch {
    return null;
  }
}

function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

async function fetchEvents(pool: Pool, slug: EventSlug): Promise<UniswapResponse | null> {
  const sr = await fetch("/v1/status", { cache: "no-store" });
  if (!sr.ok) return null;
  const { latest_indexed_block } = (await sr.json()) as Status;
  const from = Math.max(0, latest_indexed_block - 5000);
  const res = await fetch(
    `/v1/uniswap-v3/${slug}?pool=${pool.address}&from_block=${from}&to_block=${latest_indexed_block}&limit=50`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  return res.json() as Promise<UniswapResponse>;
}

export function UniswapV3Dashboard() {
  const [pool, setPool] = useState<Pool>(POOLS[0]!);
  const [slug, setSlug] = useState<EventSlug>("swap");
  const [data, setData] = useState<UniswapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    async function tick() {
      try {
        const r = await fetchEvents(pool, slug);
        if (alive) {
          setData(r);
          setError(r ? null : "no data");
          setLoading(false);
        }
      } catch (e) {
        if (alive) {
          setError(e instanceof Error ? e.message : "load failed");
          setLoading(false);
        }
      }
    }
    tick();
    const id = setInterval(tick, 12_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pool, slug]);

  return (
    <div>
      <div className="filter-bar">
        <div className="filter-group">
          <span className="filter-label">pool</span>
          {POOLS.map((p) => (
            <button
              key={p.address}
              type="button"
              className={`filter-chip${p.address === pool.address ? " active" : ""}`}
              onClick={() => setPool(p)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="filter-group">
          <span className="filter-label">event</span>
          {EVENTS.map((s) => (
            <button
              key={s}
              type="button"
              className={`filter-chip${s === slug ? " active" : ""}`}
              onClick={() => setSlug(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="endpoint-line" style={{ marginTop: 16, marginBottom: 4, fontSize: 13 }}>
        <span className="endpoint-verb">GET</span>
        <span className="mono">{`/v1/uniswap-v3/${slug}?pool=${pool.address}&\u2026`}</span>
      </div>

      {(() => {
        // Stale-data guard: between a slug click and the next fetch,
        // `data` still holds rows from the previous slug. Treating that
        // as "for the new slug" causes crashes — e.g. MintBurnTable
        // reading `r.owner` on swap rows. Only trust data whose `event`
        // matches what we're displaying.
        const expectedEvent =
          slug === "swap" ? "Swap" : slug === "mint" ? "Mint" : "Burn";
        const fresh = data && data.event === expectedEvent ? data : null;
        if (loading || !fresh) {
          return error && !loading ? (
            <div className="disclaimer" style={{ marginTop: 20 }}>
              error: <code>{error}</code>
            </div>
          ) : (
            <div className="disclaimer" style={{ marginTop: 20 }}>
              Loading…
            </div>
          );
        }
        if (fresh.events.length === 0) {
          return (
            <div className="disclaimer" style={{ marginTop: 20 }}>
              No {slug} events in the last 5,000 blocks for this pool.
            </div>
          );
        }
        return slug === "swap" ? (
          <SwapTable rows={fresh.events as SwapRow[]} pool={pool} />
        ) : (
          <MintBurnTable rows={fresh.events as MintBurnRow[]} pool={pool} />
        );
      })()}

      <div className="dashboard-meta">
        <span>{data?.count ?? 0} events · refreshes every 12 s</span>
        <span>last 5,000 blocks from chain tip</span>
        <a
          href={`/v1/uniswap-v3/${slug}?pool=${pool.address}`}
          target="_blank"
          rel="noreferrer"
        >
          raw response →
        </a>
      </div>
    </div>
  );
}

function SwapTable({ rows, pool }: { rows: SwapRow[]; pool: Pool }) {
  const sd0 = dispDec(pool.token0.decimals);
  const sd1 = dispDec(pool.token1.decimals);
  return (
    <div className="chart-card" style={{ marginTop: 16, padding: 0, overflow: "hidden" }}>
      <table className="ticker">
        <thead>
          <tr>
            <th>block</th>
            <th>tx</th>
            <th>sender</th>
            <th>recipient</th>
            <th style={{ textAlign: "right" }}>{pool.token0.symbol} Δ</th>
            <th style={{ textAlign: "right" }}>{pool.token1.symbol} Δ</th>
            <th style={{ textAlign: "right" }}>
              price ({pool.token1.symbol}/{pool.token0.symbol})
            </th>
            <th style={{ textAlign: "right" }}>tick</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.block_num}-${r.log_index}`}>
              <td className="mono">{r.block_num.toLocaleString()}</td>
              <td>
                <a
                  className="mono"
                  href={`https://arbiscan.io/tx/${r.tx_hash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {r.tx_hash.slice(0, 10)}↗
                </a>
              </td>
              <td className="mono">{short(r.sender)}</td>
              <td className="mono">{short(r.recipient)}</td>
              <td className="mono" style={{ textAlign: "right" }}>
                {fmtAmt(r.amount0, pool.token0.decimals, sd0)}
              </td>
              <td className="mono" style={{ textAlign: "right" }}>
                {fmtAmt(r.amount1, pool.token1.decimals, sd1)}
              </td>
              <td className="mono" style={{ textAlign: "right" }}>
                {calcPrice(r.amount0, r.amount1, pool) ?? "—"}
              </td>
              <td className="mono" style={{ textAlign: "right" }}>
                {Number(r.tick).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MintBurnTable({ rows, pool }: { rows: MintBurnRow[]; pool: Pool }) {
  const sd0 = dispDec(pool.token0.decimals);
  const sd1 = dispDec(pool.token1.decimals);
  return (
    <div className="chart-card" style={{ marginTop: 16, padding: 0, overflow: "hidden" }}>
      <table className="ticker">
        <thead>
          <tr>
            <th>block</th>
            <th>tx</th>
            <th>owner</th>
            <th style={{ textAlign: "right" }}>tickLower</th>
            <th style={{ textAlign: "right" }}>tickUpper</th>
            <th style={{ textAlign: "right" }}>liquidity</th>
            <th style={{ textAlign: "right" }}>{pool.token0.symbol} Δ</th>
            <th style={{ textAlign: "right" }}>{pool.token1.symbol} Δ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.block_num}-${r.log_index}`}>
              <td className="mono">{r.block_num.toLocaleString()}</td>
              <td>
                <a
                  className="mono"
                  href={`https://arbiscan.io/tx/${r.tx_hash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {r.tx_hash.slice(0, 10)}↗
                </a>
              </td>
              <td className="mono">{short(r.owner)}</td>
              <td className="mono" style={{ textAlign: "right" }}>
                {Number(r.tickLower).toLocaleString()}
              </td>
              <td className="mono" style={{ textAlign: "right" }}>
                {Number(r.tickUpper).toLocaleString()}
              </td>
              <td className="mono" style={{ textAlign: "right" }}>
                {fmtAmt(r.amount, 0, 0)}
              </td>
              <td className="mono" style={{ textAlign: "right" }}>
                {fmtAmt(r.amount0, pool.token0.decimals, sd0)}
              </td>
              <td className="mono" style={{ textAlign: "right" }}>
                {fmtAmt(r.amount1, pool.token1.decimals, sd1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
