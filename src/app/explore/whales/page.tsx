import { Nav } from "../../_components/Nav";
import { WhalesDashboard } from "./_dashboard";

export const metadata = {
  title: "whale transfers · camp",
  description: "Live feed of big USDC transfers on Arbitrum One, updated every 10s.",
};

export default function WhalesPage() {
  return (
    <>
      <Nav />
      <main>
        <section className="container" style={{ paddingTop: 64, paddingBottom: 32 }}>
          <p className="section-eyebrow">explore · whale transfers</p>
          <h1 style={{ fontSize: "clamp(36px, 5vw, 56px)", letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: 16 }}>
            Big money moves, as they happen.
          </h1>
          <p className="lede">
            Live feed of the biggest USDC transfers on Arbitrum One — every
            10 seconds we pull <code>GET /v1/whales/transfers</code> for
            the last ~5 minutes of chain time and surface anything over the
            threshold.
          </p>
        </section>

        <section className="container" style={{ paddingBottom: 96 }}>
          <WhalesDashboard />
        </section>
      </main>
    </>
  );
}
