import { Nav } from "../../_components/Nav";
import { TokenDashboard } from "./_dashboard";

export const metadata = {
  title: "token volume · camp",
  description: "Time-bucketed transfer volume + activity for any ERC-20 on Arbitrum.",
};

export default function TokenPage() {
  return (
    <>
      <Nav />
      <main>
        <section className="container" style={{ paddingTop: 64, paddingBottom: 32 }}>
          <p className="section-eyebrow">explore · token</p>
          <h1
            style={{
              fontSize: "clamp(36px, 5vw, 56px)",
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              marginBottom: 16,
            }}
          >
            Token flow, bucket by bucket.
          </h1>
          <p className="lede">
            Pick a token, pick a bucket. Two API calls —{" "}
            <code>/v1/token/{`{addr}`}/volume</code> for the bars and{" "}
            <code>/v1/transfers</code> for the tape underneath.
          </p>
        </section>
        <section className="container" style={{ paddingBottom: 96 }}>
          <TokenDashboard />
        </section>
      </main>
    </>
  );
}
