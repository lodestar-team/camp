"use client";

import { useState } from "react";

type Section = "block" | "tx" | "events";

const TRANSFER_TOPIC0 =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function isAddress(s: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(s);
}
function isHash(s: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(s);
}

export function LookupDashboard() {
  const [section, setSection] = useState<Section>("block");

  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {(["block", "tx", "events"] as Section[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSection(s)}
            className={`filter-chip ${section === s ? "active" : ""}`}
          >
            {s}
          </button>
        ))}
      </div>

      {section === "block" ? <BlockLookup /> : section === "tx" ? <TxLookup /> : <EventsLookup />}
    </>
  );
}

function ResultPanel({ result, endpoint }: { result: unknown; endpoint: string }) {
  return (
    <>
      <p className="mono" style={{ color: "var(--text-subtle)", fontSize: 12, marginBottom: 8 }}>
        {endpoint}
      </p>
      <pre
        style={{
          background: "var(--code-bg)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: 16,
          overflow: "auto",
          maxHeight: 520,
          fontSize: 12,
        }}
      >
        {JSON.stringify(result, null, 2)}
      </pre>
    </>
  );
}

function BlockLookup() {
  const [n, setN] = useState<string>("");
  const [result, setResult] = useState<unknown>(null);
  const [endpoint, setEndpoint] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    const num = Number(n);
    if (!Number.isInteger(num) || num < 0) {
      setError("Block number must be a non-negative integer");
      return;
    }
    setError(null);
    setLoading(true);
    const url = `/v1/block/${num}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      const json = (await res.json()) as unknown;
      setResult(json);
      setEndpoint(`GET ${url}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "load failed");
    } finally {
      setLoading(false);
    }
  }

  async function fillTip() {
    const res = await fetch("/v1/status", { cache: "no-store" });
    if (!res.ok) return;
    const j = (await res.json()) as { latest_indexed_block: number };
    setN(String(j.latest_indexed_block));
  }

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
        style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}
      >
        <input
          type="number"
          placeholder="block number"
          value={n}
          onChange={(e) => setN(e.target.value)}
          className="input mono"
          style={{ minWidth: 200 }}
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "…" : "Fetch"}
        </button>
        <button type="button" className="btn" onClick={fillTip}>
          Use latest tip
        </button>
      </form>
      {error ? <p style={{ color: "#b34a3a" }}>{error}</p> : null}
      {result ? <ResultPanel result={result} endpoint={endpoint} /> : null}
    </>
  );
}

function TxLookup() {
  const [h, setH] = useState<string>("");
  const [result, setResult] = useState<unknown>(null);
  const [endpoint, setEndpoint] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!isHash(h)) {
      setError("Expected 0x-prefixed 32-byte hex hash");
      return;
    }
    setError(null);
    setLoading(true);
    const url = `/v1/tx/${h.toLowerCase()}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      const json = (await res.json()) as unknown;
      setResult(json);
      setEndpoint(`GET ${url}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "load failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
        style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}
      >
        <input
          type="text"
          placeholder="0xTxHash (64 hex chars)"
          value={h}
          onChange={(e) => setH(e.target.value.trim())}
          className="input mono"
          style={{ flex: 1, minWidth: 380 }}
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "…" : "Fetch"}
        </button>
      </form>
      {error ? <p style={{ color: "#b34a3a" }}>{error}</p> : null}
      {result ? <ResultPanel result={result} endpoint={endpoint} /> : null}
    </>
  );
}

function EventsLookup() {
  const [address, setAddress] = useState<string>("");
  const [topic0, setTopic0] = useState<string>(TRANSFER_TOPIC0);
  const [span, setSpan] = useState<number>(500);
  const [result, setResult] = useState<unknown>(null);
  const [endpoint, setEndpoint] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (address && !isAddress(address)) {
      setError("Address must be 0x-prefixed 20-byte hex");
      return;
    }
    if (topic0 && !isHash(topic0)) {
      setError("topic0 must be 0x-prefixed 32-byte hex");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const statusRes = await fetch("/v1/status", { cache: "no-store" });
      const { latest_indexed_block } = (await statusRes.json()) as {
        latest_indexed_block: number;
      };
      const from = Math.max(0, latest_indexed_block - span);
      const params = new URLSearchParams({
        from_block: String(from),
        to_block: String(latest_indexed_block),
        limit: "50",
      });
      if (address) params.set("address", address.toLowerCase());
      if (topic0) params.set("topic0", topic0.toLowerCase());
      const url = `/v1/events?${params.toString()}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = (await res.json()) as unknown;
      setResult(json);
      setEndpoint(`GET ${url}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "load failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
        style={{ display: "grid", gap: 8, marginBottom: 16, maxWidth: 720 }}
      >
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="filter-label" style={{ width: 80 }}>address</span>
          <input
            type="text"
            placeholder="(optional) 0xContract"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="input mono"
            style={{ flex: 1 }}
          />
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="filter-label" style={{ width: 80 }}>topic0</span>
          <input
            type="text"
            placeholder="0x32-byte hash (event signature)"
            value={topic0}
            onChange={(e) => setTopic0(e.target.value)}
            className="input mono"
            style={{ flex: 1 }}
          />
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="filter-label" style={{ width: 80 }}>span</span>
          <input
            type="number"
            min={10}
            max={100000}
            value={span}
            onChange={(e) => setSpan(Number(e.target.value))}
            className="input mono"
            style={{ width: 120 }}
          />
          <span style={{ color: "var(--text-subtle)", fontSize: 12 }}>
            blocks back from tip (max 100,000)
          </span>
        </label>
        <div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "…" : "Fetch"}
          </button>
        </div>
      </form>
      {error ? <p style={{ color: "#b34a3a" }}>{error}</p> : null}
      {result ? <ResultPanel result={result} endpoint={endpoint} /> : null}
    </>
  );
}
