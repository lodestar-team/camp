const NUTHATCH = "https://nuthatch-indexer.com/";

export default function Home() {
  return (
    <main>
      <section className="container hero">
        <p className="section-eyebrow">retired · 2026</p>
        <h1>
          c<span className="ember">amp</span>
        </h1>
        <div className="hero-domain" aria-hidden="true">engine.camp</div>

        <p className="lede">
          camp and Amp have been <strong>retired</strong>. The self-built
          engine, the community node, the whole contraption — stood down. The
          REST API, the SQL playground, and every dashboard are gone; this page
          is all that remains.
        </p>

        <p className="lede" style={{ marginTop: 12 }}>
          Everything they did is now done better by{" "}
          <a href={NUTHATCH} target="_blank" rel="noreferrer">
            nuthatch
          </a>
          . Point a nuthatch nest at any contract and it indexes the events
          straight into a local SQL database — no shared node to babysit, no
          rate limits, no waiting on someone else&apos;s uptime. If you came here
          for Arbitrum data, go there instead.
        </p>

        <div className="cta-row">
          <a className="btn btn-primary" href={NUTHATCH} target="_blank" rel="noreferrer">
            Go to nuthatch
          </a>
          <a className="btn" href={NUTHATCH} target="_blank" rel="noreferrer">
            nuthatch-indexer.com
          </a>
        </div>

        <p
          className="lede"
          style={{ marginTop: 32, fontSize: "0.9em", color: "var(--text-muted)" }}
        >
          The old source lives on in git history. Thanks to everyone who queried
          it while it was up.
        </p>
      </section>

      <footer className="container foot">
        <span>camp · retired · superseded by nuthatch</span>
        <span>
          <a href={NUTHATCH} target="_blank" rel="noreferrer">
            nuthatch-indexer.com
          </a>
        </span>
      </footer>
    </main>
  );
}
