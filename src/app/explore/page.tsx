import { Nav } from "../_components/Nav";
import { LiveBlocks } from "../_components/LiveBlocks";

export const metadata = {
  title: "explore · camp",
  description:
    "Live dashboards over Arbitrum One — decoded protocols, gas, whales, address profiles, raw SQL, and ad-hoc lookups.",
};

const DASHBOARDS = [
  {
    href: "/explore/sql",
    title: "sql playground",
    blurb:
      "Write your own queries. Read-only DataFusion-flavoured SQL against the raw and decoded tables, with full UDF access.",
  },
  {
    href: "/explore/uniswap-v3",
    title: "uniswap v3",
    blurb:
      "Decoded swap, mint, and burn events per pool — same shape Dune ships as uniswap_v3.swap_events, at tip and free.",
  },
  {
    href: "/explore/horizon",
    title: "graph horizon",
    blurb:
      "Stake, delegation, and slashing events for the Graph Horizon protocol on Arbitrum One.",
  },
  {
    href: "/explore/whales",
    title: "whale transfers",
    blurb:
      "Live feed of the biggest token transfers across the major Arbitrum stablecoins.",
  },
  {
    href: "/explore/gas",
    title: "gas & throughput",
    blurb:
      "Real-time chart of Arbitrum's base fee, average gas per block, and per-minute throughput.",
  },
  {
    href: "/explore/token",
    title: "token volume",
    blurb:
      "Pick any ERC-20 — get bucketed transfer volume plus a tape of recent transfers underneath.",
  },
  {
    href: "/explore/address",
    title: "address profile",
    blurb:
      "Combined tx history, token transfers, and contract interactions for any wallet on Arbitrum One.",
  },
  {
    href: "/explore/contract",
    title: "contract activity",
    blurb:
      "Log-count time-series for any contract. Spot bursts, lulls, and dead deploys at a glance.",
  },
  {
    href: "/explore/lookup",
    title: "block / tx / events",
    blurb:
      "Look up a single block, a single transaction, or run an ad-hoc events filter without writing fetch().",
  },
  {
    href: "/explore/signatures",
    title: "event signatures",
    blurb:
      "Reference table of well-known topic0s the API recognises — ERC-20, ERC-721, DEXes, protocol events.",
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
