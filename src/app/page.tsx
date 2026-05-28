import { RevealObserver } from "./_components/RevealObserver";
import { CodeTabs } from "./_components/CodeTabs";
import { Nav } from "./_components/Nav";
import { LiveDepth } from "./_components/LiveDepth";
import { SqlPlayground } from "./explore/sql/_playground";

export default function Home() {
  return (
    <>
      <RevealObserver />

      <Nav />

      <main>
        {/* Hero */}
        <section className="container hero">
          <h1>
            c<span className="ember">amp</span>
          </h1>
          <p className="lede">
            A community{" "}
            Amp{" "}
            node for Arbitrum One. Read blocks, transactions, and decoded events
            through a small REST API — free, no signup, no API key. Indexed at
            chain tip; query latency under a second on typical filters.
          </p>
          <p className="lede" style={{ marginTop: 8, color: "var(--text-muted)", fontSize: "0.92em" }}>
            History rebuilds forward from <strong>2026-05-27</strong>. The
            usable window grows by ~24 h every calendar day; eventually a
            rolling ~30 d view.
            <br />
            Live depth: <LiveDepth />
          </p>
          <div className="cta-row">
            <a className="btn btn-primary" href="#sql">
              Run a query now
            </a>
            <a className="btn" href="/explore">
              Live dashboards
            </a>
            <a className="btn" href="#endpoints">
              Browse endpoints
            </a>
            <a className="btn" href="/docs">
              OpenAPI reference
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

        {/* SQL playground — front and centre */}
        <section className="block reveal" id="sql">
          <div className="container">
            <p className="section-eyebrow">live · sql · in your browser</p>
            <h2 className="section-title">Skip the endpoints. Write the query.</h2>
            <p className="section-lede">
              Direct DataFusion-flavoured SQL against the indexed Arbitrum One
              tables. Same engine the endpoints below sit on top of — one
              example loaded for you, hit <kbd className="kbd">⌘</kbd> +{" "}
              <kbd className="kbd">↩</kbd> to run. Read-only, single-statement,
              must reference <code>block_num</code> so the scan stays bounded.
            </p>
            <SqlPlayground />
            <p
              className="lede"
              style={{
                marginTop: 24,
                fontSize: "0.92em",
                color: "var(--text-muted)",
              }}
            >
              Want the full-page version with a bigger editor?{" "}
              <a href="/explore/sql" className="inline-link">
                /explore/sql
              </a>
              .
            </p>
          </div>
        </section>

        {/* Endpoints */}
        <section className="block reveal" id="endpoints">
          <div className="container">
            <p className="section-eyebrow">v1 · stable · queries</p>
            <h2 className="section-title">Parameterised SQL behind each endpoint.</h2>
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
                <CodeTabs
                  examples={{
                    curl: `curl https://camp.cargopete.com/v1/status`,
                    js: `const res = await fetch("https://camp.cargopete.com/v1/status");
const data = await res.json();
console.log(data.latest_indexed_block);`,
                    py: `import requests
data = requests.get("https://camp.cargopete.com/v1/status").json()
print(data["latest_indexed_block"])`,
                    rs: `let data: serde_json::Value = reqwest::get(
    "https://camp.cargopete.com/v1/status"
).await?.json().await?;
println!("{}", data["latest_indexed_block"]);`,
                  }}
                />
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
                <CodeTabs
                  examples={{
                    curl: `curl https://camp.cargopete.com/v1/signatures`,
                    js: `const { signatures } = await fetch(
  "https://camp.cargopete.com/v1/signatures"
).then(r => r.json());`,
                    py: `import requests
sigs = requests.get("https://camp.cargopete.com/v1/signatures").json()["signatures"]`,
                    rs: `let v: serde_json::Value = reqwest::get(
    "https://camp.cargopete.com/v1/signatures"
).await?.json().await?;`,
                  }}
                />
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
                <CodeTabs
                  examples={{
                    curl: `# USDC transfers in a 200-block window
curl "https://camp.cargopete.com/v1/transfers\\
?token=0xaf88d065e77c8cc2239327c5edb3a432268e5831\\
&from_block=466835663&to_block=466835863&limit=10"`,
                    js: `const params = new URLSearchParams({
  token: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
  from_block: "466835663",
  to_block:   "466835863",
  limit:      "10",
});
const { transfers } = await fetch(
  \`https://camp.cargopete.com/v1/transfers?\${params}\`
).then(r => r.json());`,
                    py: `import requests
r = requests.get("https://camp.cargopete.com/v1/transfers", params={
    "token":      "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
    "from_block": 466835663,
    "to_block":   466835863,
    "limit":      10,
})
transfers = r.json()["transfers"]`,
                    rs: `let r: serde_json::Value = reqwest::Client::new()
    .get("https://camp.cargopete.com/v1/transfers")
    .query(&[
        ("token",      "0xaf88d065e77c8cc2239327c5edb3a432268e5831"),
        ("from_block", "466835663"),
        ("to_block",   "466835863"),
        ("limit",      "10"),
    ])
    .send().await?.json().await?;`,
                  }}
                />
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
                <CodeTabs
                  examples={{
                    curl: `# HorizonStaking events in last 1000 blocks
curl "https://camp.cargopete.com/v1/events\\
?address=0x00669a4cf01450b64e8a2a20e9b1fcb71e61ef03\\
&from_block=466834863&to_block=466835863&limit=20"`,
                    js: `const params = new URLSearchParams({
  address:    "0x00669a4cf01450b64e8a2a20e9b1fcb71e61ef03",
  from_block: "466834863",
  to_block:   "466835863",
  limit:      "20",
});
const { events } = await fetch(
  \`https://camp.cargopete.com/v1/events?\${params}\`
).then(r => r.json());`,
                    py: `import requests
events = requests.get("https://camp.cargopete.com/v1/events", params={
    "address":    "0x00669a4cf01450b64e8a2a20e9b1fcb71e61ef03",
    "from_block": 466834863,
    "to_block":   466835863,
    "limit":      20,
}).json()["events"]`,
                    rs: `let r: serde_json::Value = reqwest::Client::new()
    .get("https://camp.cargopete.com/v1/events")
    .query(&[
        ("address",    "0x00669a4cf01450b64e8a2a20e9b1fcb71e61ef03"),
        ("from_block", "466834863"),
        ("to_block",   "466835863"),
        ("limit",      "20"),
    ])
    .send().await?.json().await?;`,
                  }}
                />
              </article>
            </div>
          </div>
        </section>

        {/* Lookups */}
        <section className="block reveal" id="lookups">
          <div className="container">
            <p className="section-eyebrow">v1 · stable · lookups</p>
            <h2 className="section-title">Look it up by block, hash, or address.</h2>
            <p className="section-lede">
              The wallet-explorer side of things. Same engine, same caps,
              shaped queries instead of generic filters. Defaults to a 100 k
              block window when no range is given.
            </p>

            <div className="endpoints">
              {/* block */}
              <article className="endpoint-card half">
                <div className="endpoint-line">
                  <span className="endpoint-verb">GET</span>
                  <span>/v1/block/&#123;n&#125;</span>
                </div>
                <p className="endpoint-desc">
                  Block header, every transaction in it, every log emitted —
                  one request, three parallel queries.
                </p>
                <CodeTabs
                  examples={{
                    curl: `curl https://camp.cargopete.com/v1/block/466862035`,
                    js: `const { block, transactions, logs } = await fetch(
  "https://camp.cargopete.com/v1/block/466862035"
).then(r => r.json());`,
                    py: `import requests
b = requests.get("https://camp.cargopete.com/v1/block/466862035").json()
print(len(b["transactions"]), "txs", len(b["logs"]), "logs")`,
                    rs: `let b: serde_json::Value = reqwest::get(
    "https://camp.cargopete.com/v1/block/466862035"
).await?.json().await?;`,
                  }}
                />
              </article>

              {/* tx */}
              <article className="endpoint-card half">
                <div className="endpoint-line">
                  <span className="endpoint-verb">GET</span>
                  <span>/v1/tx/&#123;hash&#125;</span>
                </div>
                <p className="endpoint-desc">
                  Transaction + receipt + emitted logs. Searches the last
                  100 k blocks by default; override with{" "}
                  <code>from_block</code> / <code>to_block</code>.
                </p>
                <CodeTabs
                  examples={{
                    curl: `curl https://camp.cargopete.com/v1/tx/0x7b73bf8545d992e6ee95bcb082e2fc1628413c42cfca2302da2cc649a51a7481`,
                    js: `const hash = "0x7b73bf8545d992e6ee95bcb082e2fc1628413c42cfca2302da2cc649a51a7481";
const { transaction, logs } = await fetch(
  \`https://camp.cargopete.com/v1/tx/\${hash}\`
).then(r => r.json());`,
                    py: `import requests
h = "0x7b73bf8545d992e6ee95bcb082e2fc1628413c42cfca2302da2cc649a51a7481"
tx = requests.get(f"https://camp.cargopete.com/v1/tx/{h}").json()`,
                    rs: `let h = "0x7b73bf8545d992e6ee95bcb082e2fc1628413c42cfca2302da2cc649a51a7481";
let tx: serde_json::Value = reqwest::get(
    format!("https://camp.cargopete.com/v1/tx/{}", h)
).await?.json().await?;`,
                  }}
                />
              </article>

              {/* address tx */}
              <article className="endpoint-card">
                <div className="endpoint-line">
                  <span className="endpoint-verb">GET</span>
                  <span>/v1/address/&#123;a&#125;/tx?from_block=N&amp;to_block=M&amp;direction=from|to|all&amp;limit=100</span>
                </div>
                <p className="endpoint-desc">
                  Every transaction where the address is{" "}
                  <code>from</code> or <code>to</code>, in a block range.
                  Direction defaults to <code>all</code>.
                </p>
                <CodeTabs
                  examples={{
                    curl: `# Outbound txs for an address in the last ~hour
curl "https://camp.cargopete.com/v1/address/0xe8d294f3fff2a5cb34d15ecdef34a53b01f5a462/tx\\
?from_block=466840000&to_block=466856000&direction=from&limit=25"`,
                    js: `const addr = "0xe8d294f3fff2a5cb34d15ecdef34a53b01f5a462";
const params = new URLSearchParams({
  from_block: "466840000",
  to_block:   "466856000",
  direction:  "from",
  limit:      "25",
});
const { transactions } = await fetch(
  \`https://camp.cargopete.com/v1/address/\${addr}/tx?\${params}\`
).then(r => r.json());`,
                    py: `import requests
addr = "0xe8d294f3fff2a5cb34d15ecdef34a53b01f5a462"
txs = requests.get(
    f"https://camp.cargopete.com/v1/address/{addr}/tx",
    params={
        "from_block": 466840000,
        "to_block":   466856000,
        "direction":  "from",
        "limit":      25,
    },
).json()["transactions"]`,
                    rs: `let addr = "0xe8d294f3fff2a5cb34d15ecdef34a53b01f5a462";
let r: serde_json::Value = reqwest::Client::new()
    .get(format!("https://camp.cargopete.com/v1/address/{}/tx", addr))
    .query(&[
        ("from_block", "466840000"),
        ("to_block",   "466856000"),
        ("direction",  "from"),
        ("limit",      "25"),
    ])
    .send().await?.json().await?;`,
                  }}
                />
              </article>

              {/* address transfers */}
              <article className="endpoint-card">
                <div className="endpoint-line">
                  <span className="endpoint-verb">GET</span>
                  <span>/v1/address/&#123;a&#125;/transfers?from_block=N&amp;to_block=M&amp;direction=in|out|all&amp;token=0x…</span>
                </div>
                <p className="endpoint-desc">
                  Token movements in and out of an address (any ERC-20/721),
                  decoded. Optionally scope to a single <code>token</code>{" "}
                  contract.
                </p>
                <CodeTabs
                  examples={{
                    curl: `# Inbound USDC transfers to a wallet
curl "https://camp.cargopete.com/v1/address/0xe8d294f3fff2a5cb34d15ecdef34a53b01f5a462/transfers\\
?token=0xaf88d065e77c8cc2239327c5edb3a432268e5831\\
&from_block=466840000&to_block=466856000&direction=in&limit=25"`,
                    js: `const addr  = "0xe8d294f3fff2a5cb34d15ecdef34a53b01f5a462";
const token = "0xaf88d065e77c8cc2239327c5edb3a432268e5831";
const params = new URLSearchParams({
  token,
  from_block: "466840000",
  to_block:   "466856000",
  direction:  "in",
  limit:      "25",
});
const { transfers } = await fetch(
  \`https://camp.cargopete.com/v1/address/\${addr}/transfers?\${params}\`
).then(r => r.json());`,
                    py: `import requests
addr  = "0xe8d294f3fff2a5cb34d15ecdef34a53b01f5a462"
token = "0xaf88d065e77c8cc2239327c5edb3a432268e5831"
xfers = requests.get(
    f"https://camp.cargopete.com/v1/address/{addr}/transfers",
    params={
        "token":      token,
        "from_block": 466840000,
        "to_block":   466856000,
        "direction":  "in",
        "limit":      25,
    },
).json()["transfers"]`,
                    rs: `let addr  = "0xe8d294f3fff2a5cb34d15ecdef34a53b01f5a462";
let token = "0xaf88d065e77c8cc2239327c5edb3a432268e5831";
let r: serde_json::Value = reqwest::Client::new()
    .get(format!(
        "https://camp.cargopete.com/v1/address/{}/transfers",
        addr
    ))
    .query(&[
        ("token",      token),
        ("from_block", "466840000"),
        ("to_block",   "466856000"),
        ("direction",  "in"),
        ("limit",      "25"),
    ])
    .send().await?.json().await?;`,
                  }}
                />
              </article>
            </div>
          </div>
        </section>

        {/* Aggregates */}
        <section className="block reveal" id="aggregates">
          <div className="container">
            <p className="section-eyebrow">v1 · stable · aggregates</p>
            <h2 className="section-title">Time-bucketed counts and stats.</h2>
            <p className="section-lede">
              Group-by queries baked into endpoints, so the engine does the
              fanout once and you get a series back. Buckets:{" "}
              <code>minute</code> · <code>hour</code> · <code>day</code>.
              Max 1,000 buckets per response.
            </p>

            <div className="endpoints">
              {/* gas/blocks */}
              <article className="endpoint-card">
                <div className="endpoint-line">
                  <span className="endpoint-verb">GET</span>
                  <span>/v1/gas/blocks?from_block=N&amp;to_block=M&amp;bucket=minute|hour|day</span>
                </div>
                <p className="endpoint-desc">
                  Per-bucket block stats: count, total / average{" "}
                  <code>gas_used</code>, and min / average / max{" "}
                  <code>base_fee_per_gas</code>. Cheap because the{" "}
                  <code>blocks</code> table is small.
                </p>
                <CodeTabs
                  examples={{
                    curl: `# Hourly gas stats over a 24h window
curl "https://camp.cargopete.com/v1/gas/blocks\\
?from_block=466583000&to_block=466928000&bucket=hour"`,
                    js: `const params = new URLSearchParams({
  from_block: "466583000",
  to_block:   "466928000",
  bucket:     "hour",
});
const { series } = await fetch(
  \`https://camp.cargopete.com/v1/gas/blocks?\${params}\`
).then(r => r.json());`,
                    py: `import requests
series = requests.get("https://camp.cargopete.com/v1/gas/blocks", params={
    "from_block": 466583000,
    "to_block":   466928000,
    "bucket":     "hour",
}).json()["series"]`,
                    rs: `let r: serde_json::Value = reqwest::Client::new()
    .get("https://camp.cargopete.com/v1/gas/blocks")
    .query(&[
        ("from_block", "466583000"),
        ("to_block",   "466928000"),
        ("bucket",     "hour"),
    ])
    .send().await?.json().await?;`,
                  }}
                />
              </article>

              {/* contract/activity */}
              <article className="endpoint-card">
                <div className="endpoint-line">
                  <span className="endpoint-verb">GET</span>
                  <span>/v1/contract/&#123;a&#125;/activity?from_block=N&amp;to_block=M&amp;bucket=minute|hour|day</span>
                </div>
                <p className="endpoint-desc">
                  Log count per bucket for a contract address. Useful for
                  &ldquo;is this protocol busy?&rdquo; charts without pulling
                  every event.
                </p>
                <CodeTabs
                  examples={{
                    curl: `# USDC log activity, hour buckets
curl "https://camp.cargopete.com/v1/contract/0xaf88d065e77c8cc2239327c5edb3a432268e5831/activity\\
?from_block=466583000&to_block=466928000&bucket=hour"`,
                    js: `const addr = "0xaf88d065e77c8cc2239327c5edb3a432268e5831";
const params = new URLSearchParams({
  from_block: "466583000",
  to_block:   "466928000",
  bucket:     "hour",
});
const { series } = await fetch(
  \`https://camp.cargopete.com/v1/contract/\${addr}/activity?\${params}\`
).then(r => r.json());`,
                    py: `import requests
addr = "0xaf88d065e77c8cc2239327c5edb3a432268e5831"
series = requests.get(
    f"https://camp.cargopete.com/v1/contract/{addr}/activity",
    params={
        "from_block": 466583000,
        "to_block":   466928000,
        "bucket":     "hour",
    },
).json()["series"]`,
                    rs: `let addr = "0xaf88d065e77c8cc2239327c5edb3a432268e5831";
let r: serde_json::Value = reqwest::Client::new()
    .get(format!(
        "https://camp.cargopete.com/v1/contract/{}/activity",
        addr
    ))
    .query(&[
        ("from_block", "466583000"),
        ("to_block",   "466928000"),
        ("bucket",     "hour"),
    ])
    .send().await?.json().await?;`,
                  }}
                />
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
              query an Amp node indexing Arbitrum One. Compacted parquet on local SSD keeps
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
                  <li>Raw <code>POST /v1/sql</code> for arbitrary SELECTs</li>
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
            powered by Amp
          </span>
        </footer>
      </main>
    </>
  );
}
