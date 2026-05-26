import { Nav } from "../../_components/Nav";
import { GasDashboard } from "./_dashboard";

export const metadata = {
  title: "gas & throughput · camp",
  description: "Live Arbitrum One gas and throughput chart, updated every 10s.",
};

export default function GasPage() {
  return (
    <>
      <Nav />
      <main>
        <section className="container" style={{ paddingTop: 64, paddingBottom: 32 }}>
          <p className="section-eyebrow">explore · gas &amp; throughput</p>
          <h1 style={{ fontSize: "clamp(36px, 5vw, 56px)", letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: 16 }}>
            Arbitrum One, right now.
          </h1>
          <p className="lede">
            Base fee, gas used per block, and block throughput, bucketed by
            minute over the last ~hour. Refreshes every 10 seconds. Powered
            by{" "}
            <code>
              GET /v1/gas/blocks?bucket=minute
            </code>
            .
          </p>
        </section>

        <section className="container" style={{ paddingBottom: 96 }}>
          <GasDashboard />
        </section>
      </main>
    </>
  );
}
