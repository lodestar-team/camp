"use client";

import { useEffect, useState } from "react";

type Block = {
  block_num: number;
  timestamp: string;
  gas_used: number;
  base_fee_per_gas: string | null;
};

const MAX_BUFFER = 12;

export function LiveBlocks() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [status, setStatus] = useState<"connecting" | "live" | "reconnecting">(
    "connecting",
  );

  useEffect(() => {
    let es: EventSource | null = null;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      setStatus(blocks.length > 0 ? "reconnecting" : "connecting");
      es = new EventSource("/v1/stream/blocks");
      es.addEventListener("block", (ev) => {
        try {
          const b = JSON.parse((ev as MessageEvent).data) as Block;
          setBlocks((prev) =>
            [b, ...prev]
              .filter((x, i, a) => a.findIndex((y) => y.block_num === x.block_num) === i)
              .slice(0, MAX_BUFFER),
          );
          setStatus("live");
        } catch {
          /* ignore */
        }
      });
      es.addEventListener("close", () => {
        // Browser EventSource reconnects automatically on close; we just
        // surface the state change.
        setStatus("reconnecting");
      });
      es.onerror = () => {
        setStatus("reconnecting");
      };
    }

    connect();
    return () => {
      cancelled = true;
      es?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="live-blocks">
      <div className="live-blocks-head">
        <span className="filter-label">live blocks</span>
        <span className={`live-status live-status-${status}`}>
          <span className="live-dot" /> {status}
        </span>
      </div>
      {blocks.length === 0 ? (
        <div className="live-blocks-empty">Waiting for the next block…</div>
      ) : (
        <ul className="live-blocks-list">
          {blocks.map((b) => (
            <li key={b.block_num} className="live-block-row">
              <span className="mono live-block-num">
                {b.block_num.toLocaleString()}
              </span>
              <span className="mono live-block-gas">
                {(b.gas_used / 1e6).toFixed(2)}M gas
              </span>
              <span className="mono live-block-fee">
                {b.base_fee_per_gas
                  ? `${(Number(BigInt(b.base_fee_per_gas)) / 1e9).toFixed(4)} gwei`
                  : "—"}
              </span>
              <span className="mono live-block-time">
                {new Date(b.timestamp).toISOString().slice(11, 19)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
