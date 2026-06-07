import { Nav } from "../../_components/Nav";
import { ampQuery } from "@/lib/amp";

export const metadata = {
  title: "state changes · camp",
  description:
    "Storage writes and the balance ledger (with reason) — full-instrumentation state diffs RPC can't produce, from Pinax via camp-node.",
};

export const revalidate = 30;

const DATASET = process.env.PINAX_DATASET ?? "_/eth@1.0.0";
const LO = 2_000_000;
const HI = 2_002_000;
const short = (h: string) => (h.length > 18 ? `${h.slice(0, 12)}…${h.slice(-4)}` : h);
const wei = (s: string) => {
  // show ETH with 4 dp for readability; keep raw on title
  try {
    const v = Number(BigInt(s)) / 1e18;
    return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
  } catch {
    return s;
  }
};

async function q(sql: string): Promise<Record<string, unknown>[]> {
  try {
    return await ampQuery(sql.trim());
  } catch {
    return [];
  }
}

export default async function StatePage() {
  const storage = await q(`
    SELECT block_num, ordinal,
      encode(arrow_cast(address,'Binary'),'hex') AS address,
      encode(key,'hex') AS key,
      encode(new_value,'hex') AS new_value
    FROM "${DATASET}".storage_changes
    WHERE block_num BETWEEN ${LO} AND ${HI}
    ORDER BY block_num ASC, ordinal ASC LIMIT 30`);
  const balance = await q(`
    SELECT block_num,
      encode(arrow_cast(address,'Binary'),'hex') AS address,
      old_value, new_value, reason
    FROM "${DATASET}".balance_changes
    WHERE block_num BETWEEN ${LO} AND ${HI}
    ORDER BY block_num ASC, ordinal ASC LIMIT 30`);

  const th = { padding: "8px 12px", textAlign: "left" as const };
  const td = { padding: "6px 12px" };
  const wrap = {
    overflowX: "auto" as const,
    border: "1px solid var(--border, #222)",
    borderRadius: 8,
    marginBottom: 32,
  };
  const tbl = {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: 13,
    fontFamily: "var(--font-mono, monospace)",
  };

  return (
    <>
      <Nav />
      <main>
        <section className="container" style={{ paddingTop: 64, paddingBottom: 32 }}>
          <p className="section-eyebrow">explore · state changes · full instrumentation</p>
          <h1 style={{ fontSize: "clamp(36px, 5vw, 56px)", letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: 16 }}>
            Every storage write. Every wei moved.
          </h1>
          <p className="lede">
            <strong>storage_changes</strong> (every SSTORE — contract, slot, new value) and the
            <strong> balance ledger</strong> (every balance delta, attributed with a reason:
            GAS_BUY, TRANSFER, REWARD…). State diffs a JSON-RPC indexer can&apos;t produce — from{" "}
            <a className="inline-link" href="https://pinax.network" target="_blank" rel="noreferrer">Pinax</a>{" "}
            Firehose→Parquet, materialised in-engine by{" "}
            <a className="inline-link" href="https://github.com/lodestar-team/camp-node" target="_blank" rel="noreferrer">camp-node</a>.
            Powered by <code>GET /v1/storage-changes</code> + <code>/v1/balance-changes</code> over{" "}
            <code>{DATASET}</code> (ETH-mainnet showcase slice).
          </p>
        </section>

        <section className="container" style={{ paddingBottom: 96 }}>
          <h2 style={{ fontSize: 22, marginBottom: 12 }}>storage_changes</h2>
          <div style={wrap}>
            <table style={tbl}>
              <thead>
                <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border, #222)" }}>
                  <th style={th}>block</th><th style={th}>contract</th><th style={th}>slot</th><th style={th}>new value</th>
                </tr>
              </thead>
              <tbody>
                {storage.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border, #1a1a1a)" }}>
                    <td style={td}>{Number(r.block_num)}</td>
                    <td style={td}>0x{short(String(r.address))}</td>
                    <td style={td}>0x{short(String(r.key))}</td>
                    <td style={td}>0x{short(String(r.new_value))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 style={{ fontSize: 22, marginBottom: 12 }}>balance_changes</h2>
          <div style={wrap}>
            <table style={tbl}>
              <thead>
                <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border, #222)" }}>
                  <th style={th}>block</th><th style={th}>address</th><th style={th}>reason</th>
                  <th style={{ ...th, textAlign: "right" }}>old (ETH)</th><th style={{ ...th, textAlign: "right" }}>new (ETH)</th>
                </tr>
              </thead>
              <tbody>
                {balance.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border, #1a1a1a)" }}>
                    <td style={td}>{Number(r.block_num)}</td>
                    <td style={td}>0x{short(String(r.address))}</td>
                    <td style={td}>{String(r.reason)}</td>
                    <td style={{ ...td, textAlign: "right" }} title={String(r.old_value)}>{wei(String(r.old_value))}</td>
                    <td style={{ ...td, textAlign: "right" }} title={String(r.new_value)}>{wei(String(r.new_value))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="lede" style={{ fontSize: "0.9em", color: "var(--text-muted)" }}>
            Also: <code>/v1/nonce-changes</code>, <code>/v1/code-changes</code>, <code>/v1/calls</code>.
            Try: <code>curl https://engine.camp/v1/balance-changes</code>
          </p>
        </section>
      </main>
    </>
  );
}
