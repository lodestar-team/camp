import { Nav } from "../_components/Nav";
import { LiveBlocks } from "../_components/LiveBlocks";

export const metadata = {
  title: "explore · camp",
  description: "Live dashboards over Arbitrum One — gas, whales, Graph Horizon.",
};

const DASHBOARDS = [
  {
    href: "/explore/sql",
    title: "sql playground",
    blurb:
      "Write your own queries. Read-only DataFusion-flavoured SQL against the raw and decoded tables, with full UDF access.",
  },
  {
    href: "/explore/gas",
    title: "gas & throughput",
    blurb:
      "Real-time chart of Arbitrum's base fee, average gas burnt per block, and per-minute throughput.",
  },
  {
    href: "/explore/whales",
    title: "whale transfers",
    blurb:
      "Live feed of the biggest token transfers happening right now across the major Arbitrum stablecoins.",
  },
  {
    href: "/explore/horizon",
    title: "graph horizon",
    blurb:
      "Stake, delegation, and slashing events for the Graph Horizon protocol on Arbitrum One.",
  },
];

export default function ExploreIndex() {
  return (
    <>
      <Nav />
      <main>
        <section className="container hero" style={{ paddingBottom: 40 }}>
          <p className="section-eyebrow">explore</p>
          <h1 style={{ fontSize: "clamp(40px, 6vw, 64px)", letterSpacing: "-0.035em", lineHeight: 1, marginBottom: 16 }}>
            See what the chain is doing.
          </h1>
          <p className="lede">
            Curated views over the public API. Every page is just a few
            requests against the endpoints listed on the home page — view
            source if you want to make your own.
          </p>
        </section>

        <section className="container" style={{ paddingBottom: 40 }}>
          <LiveBlocks />
        </section>

        <section className="container" style={{ paddingBottom: 96 }}>
          <div className="endpoints">
            {DASHBOARDS.map((d) => (
              <a
                key={d.href}
                href={d.href}
                className="endpoint-card"
                style={{ textDecoration: "none" }}
              >
                <div className="endpoint-line">
                  <span className="endpoint-verb">↗</span>
                  <span>{d.title}</span>
                </div>
                <p className="endpoint-desc">{d.blurb}</p>
              </a>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
