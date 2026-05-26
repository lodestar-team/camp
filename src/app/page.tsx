import { StatusBadge } from "./_components/StatusBadge";
import { RevealObserver } from "./_components/RevealObserver";

export default function Home() {
  return (
    <>
      <RevealObserver />

      <header className="nav">
        <div className="container nav-inner">
          <a href="/" className="brand">
            <svg className="brand-mark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 19 L12 5 L19 19 Z M9 16 H15"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
            camp
          </a>
          <nav className="nav-links">
            <StatusBadge />
            <a href="https://github.com/lodestar-team/camp" target="_blank" rel="noreferrer">
              github
            </a>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="container hero">
          <h1>
            c<span className="ember">amp</span>
          </h1>
          <p className="lede">
            A community{" "}
            <a href="https://github.com/edgeandnode/amp" target="_blank" rel="noreferrer">
              Amp
            </a>{" "}
            node for Arbitrum One. Read blocks, transactions, and decoded events
            through a small REST API — free, no signup, no API key. Indexed at
            chain tip; query latency under a second on typical filters.
          </p>
          <div className="cta-row">
            <a className="btn btn-primary" href="#endpoints">
              Browse endpoints
            </a>
            <a
              className="btn"
              href="https://github.com/lodestar-team/camp"
              target="_blank"
              rel="noreferrer"
            >
              Source on GitHub
            </a>
          </div>
        </section>

        {/* Endpoints */}
        <section className="block reveal" id="endpoints">
          <div className="container">
            <p className="section-eyebrow">v1 · stable</p>
            <h2 className="section-title">Four endpoints, parameterised SQL behind each.</h2>
            <p className="section-lede">
              Every request maps to a single bounded query against the indexed
              parquet tables. Block range, address, and topic filters are
              enforced server-side so the chain stays the bottleneck, not the
              gateway.
            </p>

            <div className="endpoints">
              {/* status */}
              <article className="endpoint-card half">
                <div className="endpoint-line">
                  <span className="endpoint-verb">GET</span>
                  <span>/v1/status</span>
                </div>
                <p className="endpoint-desc">
                  Latest indexed block plus indexed-block count. Cheap, cached
                  at the edge for 5 seconds.
                </p>
                <pre className="endpoint-example">{`curl https://camp.cargopete.com/v1/status`}</pre>
              </article>

              {/* signatures */}
              <article className="endpoint-card half">
                <div className="endpoint-line">
                  <span className="endpoint-verb">GET</span>
                  <span>/v1/signatures</span>
                </div>
                <p className="endpoint-desc">
                  Reference table of well-known event topic0 hashes →
                  human-readable names. Useful for decoding without an ABI.
                </p>
                <pre className="endpoint-example">{`curl https://camp.cargopete.com/v1/signatures`}</pre>
              </article>

              {/* transfers */}
              <article className="endpoint-card">
                <div className="endpoint-line">
                  <span className="endpoint-verb">GET</span>
                  <span>/v1/transfers?token=0x…&amp;from_block=N&amp;to_block=M&amp;limit=100</span>
                </div>
                <p className="endpoint-desc">
                  All <code>Transfer</code> events for an ERC-20 or ERC-721 token
                  in a block range, decoded into <code>from</code> /{" "}
                  <code>to</code> / <code>amount_hex</code>.
                </p>
                <pre className="endpoint-example">{`# USDC transfers in a 200-block window
curl "https://camp.cargopete.com/v1/transfers\\
?token=0xaf88d065e77c8cc2239327c5edb3a432268e5831\\
&from_block=466835663&to_block=466835863&limit=10"`}</pre>
              </article>

              {/* events */}
              <article className="endpoint-card">
                <div className="endpoint-line">
                  <span className="endpoint-verb">GET</span>
                  <span>/v1/events?address=0x…&amp;topic0=0x…&amp;from_block=N&amp;to_block=M&amp;limit=100</span>
                </div>
                <p className="endpoint-desc">
                  Generic log filter. <code>topic0</code> is optional; add{" "}
                  <code>topic1</code>/<code>topic2</code>/<code>topic3</code> to
                  narrow on indexed parameters such as <code>from</code> and{" "}
                  <code>to</code>.
                </p>
                <pre className="endpoint-example">{`# HorizonStaking events in last 1000 blocks
curl "https://camp.cargopete.com/v1/events\\
?address=0x00669a4cf01450b64e8a2a20e9b1fcb71e61ef03\\
&from_block=466834863&to_block=466835863&limit=20"`}</pre>
              </article>
            </div>
          </div>
        </section>

        {/* Architecture */}
        <section className="block reveal">
          <div className="container">
            <p className="section-eyebrow">how it&apos;s served</p>
            <h2 className="section-title">Edge cache in front, real engine behind.</h2>
            <p className="section-lede">
              Requests land at the edge for TLS and DDoS, traverse a Cloudflare
              tunnel to the origin, hit nginx for auth and rate limiting, then
              query an{" "}
              <a href="https://github.com/edgeandnode/amp" target="_blank" rel="noreferrer">
                Amp
              </a>{" "}
              node indexing Arbitrum One. Compacted parquet on local SSD keeps
              narrow queries sub-second.
            </p>

            <div className="arch">
              <pre>
{`client
   │
   ▼
`}<span className="strong">edge</span>{`        ─ TLS · DDoS · CDN · response cache
   │
   ▼
`}<span className="accent">cloudflare tunnel</span>{`  ─ private link to origin
   │
   ▼
`}<span className="strong">nginx</span>{`       ─ shared-secret + per-IP rate limit (Redis)
   │
   ▼
`}<span className="accent">ampd</span>{`        ─ parquet on local SSD, compactor active
   │
   ▼
arbitrum one rpc`}
              </pre>
            </div>
          </div>
        </section>

        {/* Limits */}
        <section className="block reveal">
          <div className="container">
            <p className="section-eyebrow">contract</p>
            <h2 className="section-title">What you can ask, in numbers.</h2>
            <p className="section-lede">
              Limits are the same for every caller. They&apos;re calibrated so
              the typical wallet, dashboard, or bot has plenty of headroom
              while bad actors hit the wall first.
            </p>
            <div className="limits">
              <div className="limits-row">
                <span className="limits-label">Chain</span>
                <span className="limits-value">Arbitrum One</span>
              </div>
              <div className="limits-row">
                <span className="limits-label">Tables exposed</span>
                <span className="limits-value">blocks · transactions · logs</span>
              </div>
              <div className="limits-row">
                <span className="limits-label">Max block span per request</span>
                <span className="limits-value">100,000</span>
              </div>
              <div className="limits-row">
                <span className="limits-label">Max rows per response</span>
                <span className="limits-value">1,000</span>
              </div>
              <div className="limits-row">
                <span className="limits-label">Server-side query timeout</span>
                <span className="limits-value">8 seconds</span>
              </div>
              <div className="limits-row">
                <span className="limits-label">Rate limit per IP</span>
                <span className="limits-value">30 / min · 500 / hour</span>
              </div>
              <div className="limits-row">
                <span className="limits-label">Edge cache</span>
                <span className="limits-value">1 h finalized · 5 s near tip</span>
              </div>
            </div>
          </div>
        </section>

        {/* Scope */}
        <section className="block reveal">
          <div className="container">
            <p className="section-eyebrow">scope</p>
            <h2 className="section-title">What it does, and what it doesn&apos;t.</h2>
            <p className="section-lede">
              camp serves raw, indexed event history. A few things are
              deliberately out of scope — call them out so you can plan
              around them.
            </p>
            <div className="endpoints" style={{ marginTop: 24 }}>
              <article className="endpoint-card half">
                <p className="section-eyebrow" style={{ marginBottom: 8 }}>in scope</p>
                <ul style={{ paddingLeft: 18, lineHeight: 1.8 }}>
                  <li>Event history for any contract, any block range</li>
                  <li>Transaction lookups by hash, sender, or recipient</li>
                  <li>Topic-indexed filtering (sender, recipient, token IDs)</li>
                  <li>Decoded Transfer events for ERC-20 and ERC-721</li>
                  <li>Block headers, gas, base fee, blob fields</li>
                </ul>
              </article>
              <article className="endpoint-card half">
                <p className="section-eyebrow" style={{ marginBottom: 8 }}>out of scope</p>
                <ul style={{ paddingLeft: 18, lineHeight: 1.8 }}>
                  <li>Raw SQL — write your own indexer for that</li>
                  <li>Token balances (events, not state)</li>
                  <li>USD prices — bring your own oracle</li>
                  <li>Decoded calldata / 4byte resolution</li>
                  <li>Pre-genesis history</li>
                  <li>Chains other than Arbitrum One</li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        {/* Disclaimer / Use it well */}
        <section className="block reveal">
          <div className="container">
            <p className="section-eyebrow">use it well</p>
            <h2 className="section-title">A community service. Be a good citizen.</h2>
            <div className="disclaimer">
              <p>
                camp is offered free of charge with no SLA. The endpoints are
                cached aggressively and rate-limited per IP — work with that
                rather than around it.
              </p>
              <p>
                If you&apos;re building something that depends on chain data
                being available at a specific latency, run your own Amp node.
                The dataset manifest, indexer config, and gateway code are all
                open — clone, point at your own RPC, you&apos;re done in an
                afternoon.
              </p>
              <p>
                Bug reports and feature requests:{" "}
                <a
                  href="https://github.com/lodestar-team/camp/issues"
                  target="_blank"
                  rel="noreferrer"
                >
                  github.com/lodestar-team/camp/issues
                </a>
                .
              </p>
            </div>
          </div>
        </section>

        <footer className="container foot">
          <span>camp · community Amp for Arbitrum One</span>
          <span>
            <a href="https://github.com/lodestar-team/camp" target="_blank" rel="noreferrer">
              source
            </a>{" "}
            ·{" "}
            <a href="https://github.com/edgeandnode/amp" target="_blank" rel="noreferrer">
              powered by Amp
            </a>
          </span>
        </footer>
      </main>
    </>
  );
}
