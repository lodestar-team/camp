import { Nav } from "../../_components/Nav";
import { UniswapV3Dashboard } from "./_dashboard";

export const metadata = {
  title: "uniswap v3 · camp",
  description: "Decoded swap, mint, and burn events per Uniswap V3 pool.",
};

export default function UniswapV3Page() {
  return (
    <>
      <Nav />
      <main>
        <section className="container" style={{ paddingTop: 64, paddingBottom: 32 }}>
          <p className="section-eyebrow">explore · uniswap v3</p>
          <h1
            style={{
              fontSize: "clamp(36px, 5vw, 56px)",
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              marginBottom: 16,
            }}
          >
            Pool-level liquidity, decoded at tip.
          </h1>
          <p className="lede">
            Pick a pool, pick an event. Every row below comes from a single{" "}
            <code>GET /v1/uniswap-v3/{`{swap|mint|burn}`}</code> call against the
            indexed logs — no JSON-RPC fan-out, no schema guessing.
          </p>
        </section>
        <section className="container" style={{ paddingBottom: 96 }}>
          <UniswapV3Dashboard />
        </section>
      </main>
    </>
  );
}
