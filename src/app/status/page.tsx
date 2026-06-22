import { Nav } from "../_components/Nav";
import { StatusBoard } from "./_status";

export const metadata = {
  title: "status · camp",
  description: "Live health of engine.camp — chain tip, indexing freshness, and history depth for the Arbitrum One node.",
};

export default function StatusPage() {
  return (
    <>
      <Nav />
      <main>
        <section className="container" style={{ paddingTop: 64, paddingBottom: 24 }}>
          <p className="section-eyebrow">status</p>
          <h1 style={{ fontSize: "clamp(36px, 5vw, 56px)", letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: 16 }}>
            Is camp up?
          </h1>
          <p className="lede">
            Live health of <code>engine.camp</code> — how fresh the index is, how
            far back the rolling window reaches, and whether queries are flowing.
            Refreshes every 10 seconds.
          </p>
        </section>

        <section className="container" style={{ paddingBottom: 96 }}>
          <StatusBoard />
        </section>
      </main>
    </>
  );
}
