import { Nav } from "../../_components/Nav";
import { HorizonDashboard } from "./_dashboard";

export const metadata = {
  title: "graph horizon · camp",
  description:
    "Live timeline of Graph Horizon staking, delegation, and slashing events on Arbitrum One.",
};

export default function HorizonPage() {
  return (
    <>
      <Nav />
      <main>
        <section className="container" style={{ paddingTop: 64, paddingBottom: 32 }}>
          <p className="section-eyebrow">explore · graph horizon</p>
          <h1 style={{ fontSize: "clamp(36px, 5vw, 56px)", letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: 16 }}>
            The Graph protocol, in motion.
          </h1>
          <p className="lede">
            Stake, delegation, provisioning, and slashing events from the
            HorizonStaking contract on Arbitrum One — combined into one
            timeline, updated every 10 seconds.
          </p>
        </section>

        <section className="container" style={{ paddingBottom: 96 }}>
          <HorizonDashboard />
        </section>
      </main>
    </>
  );
}
