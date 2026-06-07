import { Nav } from "../../_components/Nav";
import { ampQuery, hexCol } from "@/lib/amp";

export const metadata = {
  title: "calls / traces · camp",
  description:
    "Internal-transaction traces (calls) — full-instrumentation data RPC can't produce, sourced from Pinax Firehose→Parquet and materialised in-engine by camp-node.",
};

export const revalidate = 30;

const CALLS_DATASET = process.env.CALLS_DATASET ?? "_/eth_calls@2.0.0";

const CALL_TYPE: Record<number, string> = {
  0: "—",
  1: "CALL",
  2: "CALLCODE",
  3: "DELEGATE",
  4: "STATIC",
  5: "CREATE",
  6: "SELFDESTRUCT",
};

const short = (h: string) => (h.length > 14 ? `${h.slice(0, 10)}…${h.slice(-4)}` : h);

export default async function CallsPage() {
  let rows: Record<string, unknown>[] = [];
  let error: string | null = null;
  try {
    rows = await ampQuery(
      `
      SELECT block_num, depth, call_type, gas_consumed,
        ${hexCol("caller")} AS caller,
        ${hexCol("address")} AS address,
        CAST(value AS VARCHAR) AS value
      FROM "${CALLS_DATASET}".calls
      WHERE block_num BETWEEN 48000 AND 52000
      ORDER BY block_num ASC, "index" ASC
      LIMIT 50
    `.trim(),
    );
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <>
      <Nav />
      <main>
        <section className="container" style={{ paddingTop: 64, paddingBottom: 32 }}>
          <p className="section-eyebrow">explore · calls &amp; traces · full instrumentation</p>
          <h1
            style={{
              fontSize: "clamp(36px, 5vw, 56px)",
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              marginBottom: 16,
            }}
          >
            Internal calls. The stuff RPC hides.
          </h1>
          <p className="lede">
            Every <strong>internal transaction</strong> — contract-to-contract calls,
            delegatecalls, creates, self-destructs — with caller, callee, value, depth and
            gas. A plain JSON-RPC indexer can&apos;t produce this; it needs trace/Firehose
            instrumentation.
          </p>
          <p className="lede" style={{ marginTop: 8, color: "var(--text-muted)", fontSize: "0.92em" }}>
            Sourced from <a className="inline-link" href="https://pinax.network" target="_blank" rel="noreferrer">Pinax</a>{" "}
            Firehose→Parquet and materialised <em>in-engine</em> by{" "}
            <a className="inline-link" href="https://github.com/lodestar-team/camp-node" target="_blank" rel="noreferrer">camp-node</a>&apos;s{" "}
            <code>pinax</code> source — same query path as every other camp dataset. Powered by{" "}
            <code>GET /v1/calls</code> over <code>{CALLS_DATASET}</code>.
            <br />
            Showcase slice: ETH mainnet (Arbitrum full instrumentation pending upstream).
          </p>
        </section>

        <section className="container" style={{ paddingBottom: 96 }}>
          {error ? (
            <p className="lede" style={{ color: "var(--ember, #e06)" }}>
              Couldn&apos;t load calls: {error}
            </p>
          ) : (
            <div style={{ overflowX: "auto", border: "1px solid var(--border, #222)", borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "var(--font-mono, monospace)" }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--text-muted)", borderBottom: "1px solid var(--border, #222)" }}>
                    <th style={{ padding: "8px 12px" }}>block</th>
                    <th style={{ padding: "8px 12px" }}>depth</th>
                    <th style={{ padding: "8px 12px" }}>type</th>
                    <th style={{ padding: "8px 12px" }}>caller</th>
                    <th style={{ padding: "8px 12px" }}>callee</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>value (wei)</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>gas</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border, #1a1a1a)" }}>
                      <td style={{ padding: "6px 12px" }}>{Number(r.block_num)}</td>
                      <td style={{ padding: "6px 12px" }}>{Number(r.depth)}</td>
                      <td style={{ padding: "6px 12px" }}>{CALL_TYPE[Number(r.call_type)] ?? r.call_type}</td>
                      <td style={{ padding: "6px 12px" }}>0x{short(String(r.caller))}</td>
                      <td style={{ padding: "6px 12px" }}>0x{short(String(r.address))}</td>
                      <td style={{ padding: "6px 12px", textAlign: "right" }}>{String(r.value)}</td>
                      <td style={{ padding: "6px 12px", textAlign: "right" }}>{Number(r.gas_consumed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="lede" style={{ marginTop: 16, fontSize: "0.9em", color: "var(--text-muted)" }}>
            {rows.length} internal calls · try it: <code>curl https://engine.camp/v1/calls</code>
          </p>
        </section>
      </main>
    </>
  );
}
