"use client";

import { useEffect, useMemo, useState } from "react";

type Status = { latest_indexed_block: number };
type TxRow = {
  block_num: number;
  tx_index: number;
  tx_hash: string;
  from: string;
  to: string | null;
  value: string;
  gas_used: number;
};
type TransferRow = {
  block_num: number;
  log_index: number;
  tx_hash: string;
  token: string;
  from: string;
  to: string;
  value: string;
};
type InteractionRow = {
  contract: string;
  tx_count: number;
  first_block: number;
  last_block: number;
};

type TxRes = { count: number; transactions: TxRow[] };
type TransferRes = { count: number; transfers: TransferRow[] };
type InteractionRes = { count: number; interactions: InteractionRow[] };

type Tab = "tx" | "transfers" | "interactions";

const EXAMPLE = "0x489ee077994b6658eafa855c308275ead8097c4a"; // GMX vault — busy address

function short(addr: string | null | undefined): string {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function isAddress(s: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(s);
}

async function loadAll(addr: string): Promise<{
  tx: TxRes | null;
  transfers: TransferRes | null;
  interactions: InteractionRes | null;
}> {
  const statusRes = await fetch("/v1/status", { cache: "no-store" });
  if (!statusRes.ok) return { tx: null, transfers: null, interactions: null };
  const { latest_indexed_block } = (await statusRes.json()) as Status;
  const from = Math.max(0, latest_indexed_block - 100_000);
  const range = `from_block=${from}&to_block=${latest_indexed_block}`;
  const [a, b, c] = await Promise.all([
    fetch(`/v1/address/${addr}/tx?${range}&limit=50`, { cache: "no-store" }).then((r) =>
      r.ok ? (r.json() as Promise<TxRes>) : null,
    ),
    fetch(`/v1/address/${addr}/transfers?${range}&limit=50`, { cache: "no-store" }).then((r) =>
      r.ok ? (r.json() as Promise<TransferRes>) : null,
    ),
    fetch(`/v1/address/${addr}/interactions?${range}&limit=20`, { cache: "no-store" }).then((r) =>
      r.ok ? (r.json() as Promise<InteractionRes>) : null,
    ),
  ]);
  return { tx: a, transfers: b, interactions: c };
}

export function AddressDashboard() {
  const [input, setInput] = useState<string>(EXAMPLE);
  const [addr, setAddr] = useState<string>(EXAMPLE);
  const [tab, setTab] = useState<Tab>("tx");
  const [data, setData] = useState<Awaited<ReturnType<typeof loadAll>> | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAddress(addr)) return;
    let alive = true;
    setLoading(true);
    setError(null);
    loadAll(addr)
      .then((r) => {
        if (alive) setData(r);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : "load failed");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [addr]);

  const counts = useMemo(
    () => ({
      tx: data?.tx?.count ?? 0,
      transfers: data?.transfers?.count ?? 0,
      interactions: data?.interactions?.count ?? 0,
    }),
    [data],
  );

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = input.trim().toLowerCase();
          if (isAddress(v)) setAddr(v);
          else setError("Not a valid 0x-prefixed 20-byte address");
        }}
        style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="0x…"
          className="input mono"
          style={{ flex: 1, minWidth: 320 }}
        />
        <button type="submit" className="btn btn-primary">
          Lookup
        </button>
      </form>

      <p
        className="mono"
        style={{ color: "var(--text-subtle)", fontSize: 12, marginBottom: 16 }}
      >
        Last ~100,000 blocks. Address:{" "}
        <a
          href={`https://arbiscan.io/address/${addr}`}
          target="_blank"
          rel="noreferrer"
          className="inline-link"
        >
          {addr}
        </a>
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(["tx", "transfers", "interactions"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`filter-chip ${tab === t ? "active" : ""}`}
          >
            {t} ({counts[t]})
          </button>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        {error ? (
          <p style={{ color: "#b34a3a" }}>{error}</p>
        ) : loading || !data ? (
          <p style={{ color: "var(--text-subtle)" }}>Loading…</p>
        ) : tab === "tx" ? (
          <TxTable rows={data.tx?.transactions ?? []} />
        ) : tab === "transfers" ? (
          <TransferTable rows={data.transfers?.transfers ?? []} />
        ) : (
          <InteractionsTable rows={data.interactions?.interactions ?? []} />
        )}
      </div>
    </>
  );
}

function TxTable({ rows }: { rows: TxRow[] }) {
  if (rows.length === 0)
    return <p style={{ color: "var(--text-subtle)" }}>No transactions in window.</p>;
  return (
    <div className="table-wrap">
      <table className="data-table mono" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>block</th>
            <th>tx_hash</th>
            <th>from</th>
            <th>to</th>
            <th>value (wei)</th>
            <th>gas_used</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.block_num}-${r.tx_index}`}>
              <td>{r.block_num.toLocaleString()}</td>
              <td>{short(r.tx_hash)}</td>
              <td>{short(r.from)}</td>
              <td>{short(r.to)}</td>
              <td>{r.value}</td>
              <td>{r.gas_used.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TransferTable({ rows }: { rows: TransferRow[] }) {
  if (rows.length === 0)
    return <p style={{ color: "var(--text-subtle)" }}>No transfers in window.</p>;
  return (
    <div className="table-wrap">
      <table className="data-table mono" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>block</th>
            <th>token</th>
            <th>from</th>
            <th>to</th>
            <th>value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.block_num}-${r.log_index}-${i}`}>
              <td>{r.block_num.toLocaleString()}</td>
              <td>{short(r.token)}</td>
              <td>{short(r.from)}</td>
              <td>{short(r.to)}</td>
              <td>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InteractionsTable({ rows }: { rows: InteractionRow[] }) {
  if (rows.length === 0)
    return <p style={{ color: "var(--text-subtle)" }}>No interactions in window.</p>;
  return (
    <div className="table-wrap">
      <table className="data-table mono" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>contract</th>
            <th>txs</th>
            <th>first_block</th>
            <th>last_block</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.contract}>
              <td>
                <a
                  href={`https://arbiscan.io/address/${r.contract}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-link"
                >
                  {short(r.contract)}
                </a>
              </td>
              <td>{r.tx_count.toLocaleString()}</td>
              <td>{r.first_block.toLocaleString()}</td>
              <td>{r.last_block.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
