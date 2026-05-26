"use client";

import { useEffect, useState } from "react";

type Status = {
  latest_indexed_block: number;
  blocks_indexed: number;
};

export function StatusBadge() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/v1/status", { cache: "no-store" });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = (await res.json()) as Status;
        if (!cancelled) {
          setStatus(data);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }
    load();
    const id = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (error) {
    return (
      <span className="status-pill" data-state="down">
        offline
      </span>
    );
  }
  if (!status) {
    return <span className="status-pill" data-state="loading">connecting…</span>;
  }
  return (
    <span className="status-pill" data-state="live" title="latest indexed block">
      <span className="live-dot" /> block {status.latest_indexed_block.toLocaleString()}
    </span>
  );
}
