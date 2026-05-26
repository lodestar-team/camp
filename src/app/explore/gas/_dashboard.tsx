"use client";

import { useEffect, useState } from "react";

type GasBucket = {
  ts: string;
  blocks: number;
  total_gas: string;
  avg_gas: number;
  min_base_fee: string;
  avg_base_fee: string;
  max_base_fee: string;
};

type GasResponse = {
  bucket: "minute" | "hour" | "day";
  from_block: number;
  to_block: number;
  count: number;
  series: GasBucket[];
};

type Status = { latest_indexed_block: number };

async function loadGas(): Promise<GasResponse | null> {
  const statusRes = await fetch("/v1/status", { cache: "no-store" });
  if (!statusRes.ok) return null;
  const { latest_indexed_block } = (await statusRes.json()) as Status;
  // Pull the last ~60 minutes of chain time. Arbitrum ~250 blocks/min, so
  // 16,000 blocks is comfortably an hour of headroom; the engine clips
  // the response to whatever's actually indexed.
  const from = Math.max(0, latest_indexed_block - 16_000);
  const res = await fetch(
    `/v1/gas/blocks?bucket=minute&from_block=${from}&to_block=${latest_indexed_block}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  return (await res.json()) as GasResponse;
}

function gweiFromWei(weiStr: string): number {
  // base_fee_per_gas is a Decimal128 string. Arbitrum's base fee sits in the
  // 10s–100s of millions of wei (≈0.01–0.1 gwei), well within JS safe int.
  // We still parse as BigInt for safety then convert to gwei (÷1e9).
  try {
    return Number(BigInt(weiStr)) / 1e9;
  } catch {
    return NaN;
  }
}

export function GasDashboard() {
  const [data, setData] = useState<GasResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const r = await loadGas();
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
  }, []);

  if (error)
    return (
      <div className="disclaimer">
        Couldn&apos;t load gas data: <code>{error}</code>
      </div>
    );
  if (!data || data.series.length === 0)
    return <div className="disclaimer">No data yet — give it a few seconds…</div>;

  const series = data.series;
  const last = series[series.length - 1]!;

  // Compute summary stats
  const fees = series.map((b) => gweiFromWei(b.avg_base_fee));
  const txCounts = series.map((b) => b.blocks);
  const avgGas = series.map((b) => b.avg_gas);
  const peakFee = Math.max(...fees);
  const valleyFee = Math.min(...fees);
  const peakThroughput = Math.max(...txCounts);

  // Chart geometry
  const W = 920;
  const H = 240;
  const Lpad = 56;
  const Rpad = 16;
  const Tpad = 16;
  const Bpad = 36;
  const innerW = W - Lpad - Rpad;
  const innerH = H - Tpad - Bpad;
  const n = series.length;
  // Use a min of 4 buckets to avoid an inflated single-point chart while
  // the engine is just getting going post-reindex.
  const slots = Math.max(n, 4);
  const x = (i: number) => Lpad + (i / Math.max(slots - 1, 1)) * innerW;
  const yFee = (g: number) =>
    Tpad + innerH - ((g - valleyFee) / Math.max(peakFee - valleyFee, 0.000001)) * innerH;
  const yBlocks = (b: number) =>
    Tpad + innerH - (b / Math.max(peakThroughput, 1)) * innerH;

  const feePath = series
    .map((b, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${yFee(gweiFromWei(b.avg_base_fee)).toFixed(1)}`)
    .join(" ");

  return (
    <div>
      {/* Stat row */}
      <div className="stat-row">
        <div className="stat">
          <div className="stat-label">latest block</div>
          <div className="stat-value mono">
            {data.to_block.toLocaleString()}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">base fee · now</div>
          <div className="stat-value mono">
            {gweiFromWei(last.avg_base_fee).toFixed(4)}
            <span className="stat-unit">gwei</span>
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">throughput · last min</div>
          <div className="stat-value mono">
            {last.blocks}
            <span className="stat-unit">blocks</span>
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">avg gas / block</div>
          <div className="stat-value mono">
            {(last.avg_gas / 1e6).toFixed(2)}
            <span className="stat-unit">M</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="chart-card">
        <div className="chart-title">avg base fee · gwei · per minute</div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          preserveAspectRatio="none"
          role="img"
          aria-label="Arbitrum One average base fee per minute"
        >
          {/* Grid */}
          {[0, 0.25, 0.5, 0.75, 1].map((p) => (
            <line
              key={p}
              x1={Lpad}
              x2={W - Rpad}
              y1={Tpad + p * innerH}
              y2={Tpad + p * innerH}
              stroke="var(--border)"
              strokeWidth="1"
              strokeDasharray={p === 0 || p === 1 ? undefined : "2,3"}
            />
          ))}
          {/* Y labels */}
          {[0, 1].map((p) => (
            <text
              key={p}
              x={Lpad - 8}
              y={Tpad + p * innerH + 4}
              textAnchor="end"
              fontSize="11"
              fill="var(--text-subtle)"
              fontFamily="var(--font-mono)"
            >
              {p === 0 ? peakFee.toFixed(3) : valleyFee.toFixed(3)}
            </text>
          ))}
          {/* Fee line */}
          <path
            d={feePath}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Points (only for the last few, to keep it readable) */}
          {series.slice(-Math.min(series.length, 30)).map((b, idx) => {
            const i = series.length - Math.min(series.length, 30) + idx;
            return (
              <circle
                key={b.ts}
                cx={x(i)}
                cy={yFee(gweiFromWei(b.avg_base_fee))}
                r={i === series.length - 1 ? 4 : 2}
                fill="var(--accent)"
              />
            );
          })}
        </svg>
      </div>

      <div className="chart-card" style={{ marginTop: 20 }}>
        <div className="chart-title">throughput · blocks per minute</div>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none">
          {[0, 0.5, 1].map((p) => (
            <line
              key={p}
              x1={Lpad}
              x2={W - Rpad}
              y1={Tpad + p * innerH}
              y2={Tpad + p * innerH}
              stroke="var(--border)"
              strokeDasharray={p === 0.5 ? "2,3" : undefined}
            />
          ))}
          {series.map((b, i) => {
            const barW = Math.max(2, innerW / Math.max(slots, 1) - 3);
            const xx = x(i) - barW / 2;
            const yy = yBlocks(b.blocks);
            return (
              <rect
                key={b.ts}
                x={xx}
                y={yy}
                width={barW}
                height={Tpad + innerH - yy}
                fill="var(--text)"
                opacity={i === series.length - 1 ? 0.95 : 0.35}
                rx="1"
              />
            );
          })}
          <text
            x={Lpad - 8}
            y={Tpad + 4}
            textAnchor="end"
            fontSize="11"
            fill="var(--text-subtle)"
            fontFamily="var(--font-mono)"
          >
            {peakThroughput}
          </text>
          <text
            x={Lpad - 8}
            y={Tpad + innerH}
            textAnchor="end"
            fontSize="11"
            fill="var(--text-subtle)"
            fontFamily="var(--font-mono)"
          >
            0
          </text>
        </svg>
      </div>

      <div className="dashboard-meta">
        <span>{series.length} buckets · 1-minute resolution</span>
        <span>updated every 10 s</span>
        <a href={`/v1/gas/blocks?bucket=minute&from_block=${data.from_block}&to_block=${data.to_block}`} target="_blank" rel="noreferrer">
          view raw response →
        </a>
      </div>
    </div>
  );
}
