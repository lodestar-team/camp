import { Nav } from "../../_components/Nav";
import { EVENT_SIGNATURES } from "@/lib/signatures";

export const metadata = {
  title: "event signatures · camp",
  description: "Reference table of well-known event topic0s used across Arbitrum protocols.",
};

export default function SignaturesPage() {
  return (
    <>
      <Nav />
      <main>
        <section className="container" style={{ paddingTop: 64, paddingBottom: 32 }}>
          <p className="section-eyebrow">explore · signatures</p>
          <h1
            style={{
              fontSize: "clamp(36px, 5vw, 56px)",
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              marginBottom: 16,
            }}
          >
            topic0, decoded.
          </h1>
          <p className="lede">
            Reference table for the well-known event signatures the API
            recognises. Same data, served as JSON at{" "}
            <code>
              <a href="/v1/signatures" className="inline-link">/v1/signatures</a>
            </code>
            .
          </p>
        </section>
        <section className="container" style={{ paddingBottom: 96 }}>
          <div className="table-wrap">
            <table className="data-table mono" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>name</th>
                  <th>signature</th>
                  <th>topic0</th>
                  <th>indexed</th>
                </tr>
              </thead>
              <tbody>
                {EVENT_SIGNATURES.map((s) => (
                  <tr key={s.topic0}>
                    <td>{s.name}</td>
                    <td>{s.signature}</td>
                    <td title={s.topic0}>{s.topic0.slice(0, 10)}…{s.topic0.slice(-4)}</td>
                    <td>{s.indexed.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
