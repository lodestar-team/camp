"use client";

import { useEffect, useState } from "react";

type StatusResp = {
  chain: string;
  dataset: string;
  latest_indexed_block: number;
  earliest_indexed_block: number;
  blocks_indexed: number;
  history_seconds: number;
  earliest_indexed_at: string;
  latest_indexed_at: string;
  elapsed_ms: number;
};

type Health = "operational" | "lagging" | "stale" | "unreachable" | "loading";

const HEALTH_COLOR: Record<Health, string> = {
  operational: "#21c07a",
  lagging: "#e0a82e",
  stale: "#e0552e",
  unreachable: "#e0552e",
  loading: "#888",
};

const HEALTH_LABEL: Record<Health, string> = {
  operational: "Operational",
  lagging: "Lagging",
  stale: "Stale",
  unreachable: "Unreachable",
  loading: "Checking…",
};

function fmtDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtAgo(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 90) return `${Math.round(seconds)}s ago`;
  if (seconds < 5400) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

export function StatusBoard() {
  const [data, setData] = useState<StatusResp | null>(null);
  const [health, setHealth] = useState<Health>("loading");
  const [lagSec, setLagSec] = useState<number>(0);
  const [checkedAt, setCheckedAt] = useState<number>(0);

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const res = await fetch("/v1/status", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const s: StatusResp = await res.json();
        if (!alive) return;
        const lag = (Date.now() - new Date(s.latest_indexed_at).getTime()) / 1000;
        setData(s);
        setLagSec(lag);
        setHealth(lag < 60 ? "operational" : lag < 300 ? "lagging" : "stale");
        setCheckedAt(Date.now());
      } catch {
        if (!alive) return;
        setHealth("unreachable");
        setCheckedAt(Date.now());
      }
    }
    poll();
    const id = setInterval(poll, 10_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const dotColor = HEALTH_COLOR[health];

  return (
    <div>
      {/* Headline health pill */}
      <div
        className="chart-card"
        style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 24px" }}
      >
        <span
          aria-hidden
          style={{
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: dotColor,
            boxShadow: `0 0 0 4px ${dotColor}22`,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" }}>
            {HEALTH_LABEL[health]}
          </div>
          <div className="filter-label" style={{ marginTop: 2 }}>
            {health === "unreachable"
              ? "engine.camp is not responding"
              : data
                ? `indexing at chain tip · last block ${fmtAgo(lagSec)}`
                : "contacting engine.camp…"}
          </div>
        </div>
        <span className="filter-label">auto-refresh 10s</span>
      </div>

      {/* Metrics grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginTop: 12,
        }}
      >
        <Metric label="latest indexed block" value={data ? data.latest_indexed_block.toLocaleString() : "—"} mono />
        <Metric label="history depth" value={data ? fmtDuration(data.history_seconds) : "—"} />
        <Metric label="blocks indexed" value={data ? data.blocks_indexed.toLocaleString() : "—"} mono />
        <Metric label="tip freshness" value={data ? fmtAgo(lagSec) : "—"} />
        <Metric label="earliest block" value={data ? data.earliest_indexed_block.toLocaleString() : "—"} mono />
        <Metric label="status query latency" value={data ? `${data.elapsed_ms} ms` : "—"} mono />
        <Metric label="chain" value={data ? data.chain : "—"} />
        <Metric label="dataset" value={data ? data.dataset : "—"} mono />
      </div>

      <div className="dashboard-meta" style={{ marginTop: 16 }}>
        <span>
          {data
            ? `window: ${new Date(data.earliest_indexed_at).toISOString().slice(0, 16).replace("T", " ")} → ${new Date(
                data.latest_indexed_at,
              )
                .toISOString()
                .slice(0, 16)
                .replace("T", " ")} UTC`
            : ""}
        </span>
        <span>
          {checkedAt
            ? `checked ${new Date(checkedAt).toLocaleTimeString()}`
            : ""}{" "}
          · source <a href="/v1/status">/v1/status</a>
        </span>
      </div>

      <div className="disclaimer" style={{ marginTop: 20 }}>
        camp runs on a single self-hosted node and is offered best-effort, free, with no SLA.
        History rebuilds forward and grows ~24h per calendar day toward a rolling ~30-day window.
        This page reads the public <a href="/v1/status">/v1/status</a> endpoint — wire it into your
        own uptime monitor if you depend on camp.
      </div>
    </div>
  );
}

function Metric({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="chart-card" style={{ padding: "16px 18px" }}>
      <div className="filter-label" style={{ marginBottom: 6 }}>
        {label}
      </div>
      <div
        className={mono ? "mono" : undefined}
        style={{ fontSize: 18, fontWeight: 600, wordBreak: "break-all" }}
      >
        {value}
      </div>
    </div>
  );
}
