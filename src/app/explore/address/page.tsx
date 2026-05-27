import { Nav } from "../../_components/Nav";
import { AddressDashboard } from "./_dashboard";

export const metadata = {
  title: "address profile · camp",
  description: "Recent transactions, token transfers, and contract interactions for any Arbitrum address.",
};

export default function AddressPage() {
  return (
    <>
      <Nav />
      <main>
        <section className="container" style={{ paddingTop: 64, paddingBottom: 32 }}>
          <p className="section-eyebrow">explore · address</p>
          <h1
            style={{
              fontSize: "clamp(36px, 5vw, 56px)",
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              marginBottom: 16,
            }}
          >
            Wallet, end-to-end.
          </h1>
          <p className="lede">
            Paste an EVM address. We fan out three calls in parallel —{" "}
            <code>/v1/address/{`{addr}`}/tx</code>,{" "}
            <code>/transfers</code>, and{" "}
            <code>/interactions</code> — and stitch them into one view.
          </p>
        </section>
        <section className="container" style={{ paddingBottom: 96 }}>
          <AddressDashboard />
        </section>
      </main>
    </>
  );
}
