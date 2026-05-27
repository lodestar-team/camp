"use client";

import { useEffect, useState } from "react";

type Status = {
  history_seconds?: number;
  earliest_indexed_at?: string | null;
};

function humanDepth(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m} min ${s} s` : `${m} min`;
  }
  if (seconds < 86_400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h} h ${m} min` : `${h} h`;
  }
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3600);
  return h > 0 ? `${d} d ${h} h` : `${d} d`;
}

export function LiveDepth() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch("/v1/status", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as Status;
        if (!cancelled) setStatus(data);
      } catch {
        /* ignore */
      }
    }
    tick();
    const id = setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!status || typeof status.history_seconds !== "number") {
    return <span style={{ color: "var(--text-subtle)" }}>—</span>;
  }
  const since = status.earliest_indexed_at
    ? new Date(status.earliest_indexed_at).toISOString().slice(0, 16).replace("T", " ") + " UTC"
    : null;
  return (
    <span>
      <strong>{humanDepth(status.history_seconds)}</strong>
      {since ? <span style={{ color: "var(--text-subtle)" }}> · since {since}</span> : null}
    </span>
  );
}
