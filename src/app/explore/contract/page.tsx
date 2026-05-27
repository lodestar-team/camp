import { Nav } from "../../_components/Nav";
import { ContractDashboard } from "./_dashboard";

export const metadata = {
  title: "contract activity · camp",
  description: "Log-count time-series for any Arbitrum contract.",
};

export default function ContractPage() {
  return (
    <>
      <Nav />
      <main>
        <section className="container" style={{ paddingTop: 64, paddingBottom: 32 }}>
          <p className="section-eyebrow">explore · contract</p>
          <h1
            style={{
              fontSize: "clamp(36px, 5vw, 56px)",
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              marginBottom: 16,
            }}
          >
            Contract heartbeat.
          </h1>
          <p className="lede">
            Paste a contract address. We bucket its emitted logs over the
            indexed window so you can spot bursts, lulls, and dead deploys at a
            glance. One API call:{" "}
            <code>/v1/contract/{`{addr}`}/activity?bucket=…</code>.
          </p>
        </section>
        <section className="container" style={{ paddingBottom: 96 }}>
          <ContractDashboard />
        </section>
      </main>
    </>
  );
}
