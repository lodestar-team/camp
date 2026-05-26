export default function Home() {
  return (
    <main>
      <header>
        <h1>
          <span className="accent">c</span>amp
        </h1>
        <p className="tag">
          Community <a href="https://github.com/edgeandnode/amp" target="_blank" rel="noreferrer">Amp</a> node — a free, tip-fresh, best-effort REST gateway over Arbitrum One.
          Runs on a single ThinkPad. No SLA.
        </p>
      </header>

      <section>
        <h2>What it is</h2>
        <p>
          Arbitrum One <code>blocks</code>, <code>transactions</code> and{" "}
          <code>logs</code> indexed by{" "}
          <a href="https://github.com/edgeandnode/amp" target="_blank" rel="noreferrer">
            Amp
          </a>{" "}
          and exposed as parameterized REST endpoints. Pre-baked query shapes only —
          no raw SQL yet. New blocks index live; older history backfills as the
          node catches up.
        </p>
      </section>

      <section>
        <h2>Endpoints</h2>

        <div className="endpoint"><span className="verb">GET</span> /v1/status</div>
        <p>Latest indexed block + indexed-block count.</p>
        <pre>{`curl https://amp-public-api.vercel.app/v1/status`}</pre>

        <div className="endpoint"><span className="verb">GET</span> /v1/signatures</div>
        <p>Reference of well-known event signatures (topic0 → name).</p>
        <pre>{`curl https://amp-public-api.vercel.app/v1/signatures`}</pre>

        <div className="endpoint">
          <span className="verb">GET</span> /v1/transfers?token=0x…&amp;from_block=N&amp;to_block=M&amp;limit=100
        </div>
        <p>ERC-20 / ERC-721 Transfer events for the given token, decoded.</p>
        <pre>{`# USDC transfers in a 200-block window
curl "https://amp-public-api.vercel.app/v1/transfers\\
?token=0xaf88d065e77c8cc2239327c5edb3a432268e5831\\
&from_block=466835663&to_block=466835863&limit=10"`}</pre>

        <div className="endpoint">
          <span className="verb">GET</span> /v1/events?address=0x…&amp;topic0=0x…&amp;from_block=N&amp;to_block=M&amp;limit=100
        </div>
        <p>
          Generic log filter. <code>topic0</code> is optional; add{" "}
          <code>topic1</code>/<code>topic2</code>/<code>topic3</code> to narrow
          indexed arguments (e.g. sender, recipient).
        </p>
        <pre>{`# HorizonStaking events in last 1000 blocks
curl "https://amp-public-api.vercel.app/v1/events\\
?address=0x00669a4cf01450b64e8a2a20e9b1fcb71e61ef03\\
&from_block=466834863&to_block=466835863&limit=20"`}</pre>
      </section>

      <section>
        <h2>Limits &amp; contract</h2>
        <table>
          <tbody>
            <tr><th>Chain</th><td>Arbitrum One</td></tr>
            <tr><th>Tables</th><td><code>blocks</code>, <code>transactions</code>, <code>logs</code></td></tr>
            <tr><th>Max block span per request</th><td>100,000</td></tr>
            <tr><th>Max rows per response</th><td>1,000</td></tr>
            <tr><th>Server-side query timeout</th><td>8 s</td></tr>
            <tr><th>Rate limit (anon, per IP)</th><td>30 req / min · 500 req / hour</td></tr>
            <tr><th>Cache</th><td>1 h for past-finalized ranges · 5 s near tip</td></tr>
          </tbody>
        </table>
        <p>
          When a request exceeds limits you get a 400 (validation) or 429 (rate
          limit) with a JSON error body:{" "}
          <code>{`{ error: { code, message, hint } }`}</code>.
        </p>
      </section>

      <section>
        <h2>What&apos;s missing (on purpose)</h2>
        <ul>
          <li>No raw <code>/v1/sql</code> — too easy to OOM a laptop. Maybe later, behind tokens.</li>
          <li>No token balances. We have <em>events</em>, not state; reconstruct from Transfers if you need them.</li>
          <li>No USD prices. Bring your own oracle.</li>
          <li>No decoded calldata for transactions. Function signatures aren&apos;t resolved.</li>
          <li>No pre-genesis history. Only what&apos;s indexed since we started.</li>
          <li>One chain. Arbitrum One only.</li>
        </ul>
      </section>

      <section>
        <h2>Disclaimer</h2>
        <div className="warn">
          This is a hobby service. The origin node is one consumer laptop on
          residential internet. Expect downtime when it reboots, lag when it&apos;s
          busy, and zero response when its owner is asleep.{" "}
          <strong>Do not build production systems against this URL.</strong> If
          something breaks, the right reaction is to self-host Amp using this
          same architecture — not to file a support ticket.
        </div>
      </section>

      <footer>
        <p>
          ampd · Cloudflare Tunnel · Vercel ·{" "}
          <a href="https://github.com/edgeandnode/amp" target="_blank" rel="noreferrer">
            Amp
          </a>
        </p>
      </footer>
    </main>
  );
}
