import { Nav } from "../../_components/Nav";
import { LookupDashboard } from "./_dashboard";

export const metadata = {
  title: "lookup · camp",
  description: "Block, transaction, and event lookup against the indexed Arbitrum data.",
};

export default function LookupPage() {
  return (
    <>
      <Nav />
      <main>
        <section className="container" style={{ paddingTop: 64, paddingBottom: 32 }}>
          <p className="section-eyebrow">explore · lookup</p>
          <h1
            style={{
              fontSize: "clamp(36px, 5vw, 56px)",
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              marginBottom: 16,
            }}
          >
            Block, tx, or topic — by hand.
          </h1>
          <p className="lede">
            The three primitives every chain explorer needs:{" "}
            <code>/v1/block/{`{n}`}</code>, <code>/v1/tx/{`{hash}`}</code>, and{" "}
            <code>/v1/events</code>. Wired to inputs so you can poke at them
            without writing fetch().
          </p>
        </section>
        <section className="container" style={{ paddingBottom: 96 }}>
          <LookupDashboard />
        </section>
      </main>
    </>
  );
}
