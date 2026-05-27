"use client";

import { useEffect, useState } from "react";

type Status = { latest_indexed_block: number };

type HorizonEventRow = {
  block_num: number;
  log_index: number;
  tx_hash: string;
  // Plus the decoded fields, varying per event:
  [key: string]: unknown;
};

type HorizonResponse = {
  event: string;
  count: number;
  events: HorizonEventRow[];
};

// Five event slugs that cover the bulk of Horizon activity. Each is its
// own endpoint (decoded per-event), so we fan them out client-side and
// merge into a single chronological view.
const FANOUT = [
  "tokens-delegated",
  "tokens-undelegated",
  "delegated-tokens-withdrawn",
  "provision-created",
  "provision-slashed",
  "delegation-slashed",
  "horizon-stake-deposited",
  "horizon-stake-withdrawn",
] as const;

type EventWithSlug = HorizonEventRow & { _slug: string; _name: string };

async function loadAll(): Promise<EventWithSlug[]> {
  const statusRes = await fetch("/v1/status", { cache: "no-store" });
  if (!statusRes.ok) return [];
  const { latest_indexed_block } = (await statusRes.json()) as Status;
  // Horizon activity is sparse — use the full 100k block-span cap to
  // catch as much history as the engine's current window holds.
  const from = Math.max(0, latest_indexed_block - 100_000);

  const responses = await Promise.allSettled(
    FANOUT.map(async (slug) => {
      const res = await fetch(
        `/v1/horizon/${slug}?from_block=${from}&to_block=${latest_indexed_block}&limit=50`,
        { cache: "no-store" },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as HorizonResponse;
      return { slug, data };
    }),
  );

  const events: EventWithSlug[] = [];
  for (const r of responses) {
    if (r.status !== "fulfilled" || !r.value) continue;
    const { slug, data } = r.value;
    for (const ev of data.events) {
      events.push({ ...ev, _slug: slug, _name: data.event });
    }
  }
  events.sort((a, b) =>
    b.block_num !== a.block_num
      ? b.block_num - a.block_num
      : b.log_index - a.log_index,
  );
  return events;
}

function fmtGrt(value: unknown): string {
  if (typeof value !== "string") return "—";
  try {
    const v = BigInt(value);
    const div = 10n ** 18n;
    const whole = v / div;
    const frac = v % div;
    const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const fracStr = frac.toString().padStart(18, "0").slice(0, 2);
    return `${wholeStr}.${fracStr}`;
  } catch {
    return value;
  }
}

function short(addr: unknown): string {
  if (typeof addr !== "string") return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function describe(ev: EventWithSlug): string {
  // Best-effort one-liner per event type — uses the decoded fields.
  switch (ev._slug) {
    case "tokens-delegated":
      return `${short(ev["delegator"])} delegated ${fmtGrt(ev["tokens"])} GRT to ${short(ev["serviceProvider"])}`;
    case "tokens-undelegated":
      return `${short(ev["delegator"])} initiated undelegation of ${fmtGrt(ev["tokens"])} GRT from ${short(ev["serviceProvider"])}`;
    case "delegated-tokens-withdrawn":
      return `${short(ev["delegator"])} withdrew ${fmtGrt(ev["tokens"])} GRT`;
    case "provision-created":
      return `${short(ev["serviceProvider"])} provisioned ${fmtGrt(ev["tokens"])} GRT to verifier ${short(ev["verifier"])}`;
    case "provision-slashed":
      return `${short(ev["serviceProvider"])} slashed for ${fmtGrt(ev["tokens"])} GRT by ${short(ev["verifier"])}`;
    case "delegation-slashed":
      return `delegation slashed: ${fmtGrt(ev["tokens"])} GRT (provider ${short(ev["serviceProvider"])})`;
    case "horizon-stake-deposited":
      return `${short(ev["serviceProvider"])} staked ${fmtGrt(ev["tokens"])} GRT`;
    case "horizon-stake-withdrawn":
      return `${short(ev["serviceProvider"])} withdrew ${fmtGrt(ev["tokens"])} GRT`;
    default:
      return ev._name;
  }
}

function severityClass(slug: string): string {
  if (slug.includes("slashed")) return "row-slash";
  if (slug.includes("delegated") || slug.includes("delegation"))
    return "row-delegation";
  return "row-stake";
}

export function HorizonDashboard() {
  const [events, setEvents] = useState<EventWithSlug[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const e = await loadAll();
        if (alive) {
          setEvents(e);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (alive) {
          setError(err instanceof Error ? err.message : "load failed");
          setLoading(false);
        }
      }
    }
    tick();
    const id = setInterval(tick, 10_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const byType: Record<string, number> = {};
  for (const ev of events) byType[ev._slug] = (byType[ev._slug] ?? 0) + 1;

  return (
    <div>
      <div className="stat-row">
        <div className="stat">
          <div className="stat-label">events in window</div>
          <div className="stat-value mono">{events.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">slashing events</div>
          <div className="stat-value mono">
            {(byType["provision-slashed"] ?? 0) +
              (byType["delegation-slashed"] ?? 0)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">delegation events</div>
          <div className="stat-value mono">
            {(byType["tokens-delegated"] ?? 0) +
              (byType["tokens-undelegated"] ?? 0) +
              (byType["delegated-tokens-withdrawn"] ?? 0)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">window</div>
          <div className="stat-value mono" style={{ fontSize: 22 }}>
            ~6 h
          </div>
        </div>
      </div>

      {loading ? (
        <div className="disclaimer" style={{ marginTop: 20 }}>
          Loading…
        </div>
      ) : error ? (
        <div className="disclaimer" style={{ marginTop: 20 }}>
          Load error: <code>{error}</code>
        </div>
      ) : events.length === 0 ? (
        <div className="disclaimer" style={{ marginTop: 20 }}>
          <strong>No Horizon events in the indexed window yet.</strong> The
          node reindexes every hour while we wait on the compactor — and
          Horizon activity is sparse (a few events per day, not per
          minute). Check back, or filter the underlying endpoints by a
          specific service provider to widen the search.
        </div>
      ) : (
        <div className="chart-card" style={{ marginTop: 20, padding: 0, overflow: "hidden" }}>
          <table className="ticker">
            <thead>
              <tr>
                <th>block</th>
                <th>event</th>
                <th>description</th>
                <th>tx</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr
                  key={`${ev.block_num}-${ev.log_index}`}
                  className={severityClass(ev._slug)}
                >
                  <td className="mono">{ev.block_num.toLocaleString()}</td>
                  <td className="mono">
                    <span className="event-pill">{ev._slug}</span>
                  </td>
                  <td>{describe(ev)}</td>
                  <td>
                    <a
                      className="mono"
                      href={`https://arbiscan.io/tx/${ev.tx_hash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {(ev.tx_hash as string).slice(0, 10)}↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="dashboard-meta">
        <span>{events.length} events · refreshes every 10 s</span>
        <span>
          fan-out across <code>/v1/horizon/{`{event}`}</code>
        </span>
        <a href="/v1/horizon" target="_blank" rel="noreferrer">
          event catalog →
        </a>
      </div>
    </div>
  );
}
