import { Nav } from "../../_components/Nav";
import { SqlPlayground } from "./_playground";

export const metadata = {
  title: "sql playground · camp",
  description:
    "Run arbitrary SELECT queries against camp's Arbitrum One index, in the browser.",
};

export default function SqlPage() {
  return (
    <>
      <Nav />
      <main>
        <section className="container" style={{ paddingTop: 64, paddingBottom: 32 }}>
          <p className="section-eyebrow">explore · sql playground</p>
          <h1 style={{ fontSize: "clamp(36px, 5vw, 56px)", letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: 16 }}>
            Write the query yourself.
          </h1>
          <p className="lede">
            Direct DataFusion-flavoured SQL against the indexed Arbitrum
            One tables. Powered by <code>POST /v1/sql</code>. Read-only,
            single-statement, must include a <code>block_num</code> filter
            so the engine has something to prune against.
          </p>
        </section>

        <section className="container" style={{ paddingBottom: 96 }}>
          <SqlPlayground />
        </section>
      </main>
    </>
  );
}
