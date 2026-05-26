# camp

Community **Amp** node for Arbitrum One. A free REST gateway over indexed blocks, transactions, and events — no signup, no API key, sub-second query latency on typical filters.

Live at **https://camp.cargopete.com**.

See [src/app/page.tsx](src/app/page.tsx) for the public-facing landing page (endpoint catalog, rate limits, scope).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/v1/status` | Latest indexed block + indexed-block count |
| GET | `/v1/signatures` | Reference of well-known event topic0s |
| GET | `/v1/transfers?token=…&from_block=…&to_block=…&limit=…` | ERC-20 / 721 Transfer events, decoded |
| GET | `/v1/events?address=…&topic0=…&topic1=…&from_block=…&to_block=…&limit=…` | Generic log filter |

Server-side caps: block span ≤ 100,000 · rows ≤ 1,000 · query timeout 8 s. Rate limit: 30/min · 500/hour per IP.

## Architecture

```
client
  ↓
amp-public-api.vercel.app           (edge: TLS, DDoS, CDN cache)
  ↓
Cloudflare Tunnel                   (private origin link;
  ↓                                  URL auto-rotates and re-syncs)
nginx                               (shared-secret + Redis rate limit)
  ├─ /         → ampd JSONL         (token-gated SQL)
  ├─ /srh/     → Redis HTTP shim    (rate-limit state)
  └─ /healthz
  ↓
ampd  (Arbitrum One indexer; parquet on local SSD, compactor active)
```

The ampd node, Redis shim, nginx, and the cloudflared tunnel live in a separate ops repo. This project is the public-facing Vercel gateway only.

## Local dev

```bash
npm install
cp .env.example .env.local       # then fill in
npm run dev                      # http://localhost:3000
```

Point `AMP_ORIGIN` at `http://localhost:1604` when running against a local ampd. Rate limiting gracefully no-ops without the `UPSTASH_*` vars.

## Env vars

| Var | Purpose |
|-----|---------|
| `AMP_ORIGIN` | Base URL of the ampd JSONL endpoint (via tunnel in prod) |
| `AMP_TOKEN` | Shared secret nginx expects in `X-Amp-Token` |
| `AMP_DATASET` | Fully-qualified dataset@version, e.g. `_/arbitrum_one@2.0.0` |
| `AMP_QUERY_TIMEOUT_MS` | Per-query hard cap, must be < Vercel function timeout (8000 default) |
| `UPSTASH_REDIS_REST_URL` | Redis REST URL (self-hosted shim or Upstash); enables rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Bearer token the Redis REST endpoint expects |

## Roadmap

Tracking the bigger plan in [ROADMAP.md](ROADMAP.md). Highlights:

- **Phase 1** — more lookups against existing data: `/v1/block`, `/v1/tx`, `/v1/address/*/tx`, `/v1/address/*/transfers`, gas time-series, contract activity, whale-Transfer feed
- **Phase 2** — aggregates that need SQL primitive verification: token volume / holders, address interactions
- **Phase 3** — anonymous tokens + raw `POST /v1/sql` behind cost-based budget
- **Phase 4** — decoded tables for the top ~20 Arbitrum protocols (Uniswap, Aave, GMX, Stargate, Graph Horizon, etc.)
- **Phase 5** — saved-query share URLs, CSV/Arrow export, webhooks/SSE, OpenAPI client
- **Phase 6** — USD prices, ENS labels, eventually a second chain

## Deploys

The Vercel project isn't Git-connected — deploys happen via `vercel --prod` from a local checkout. Automation in the ops repo redeploys automatically whenever the origin tunnel URL rotates.

For a manual deploy of code changes:

```bash
vercel --prod
```

## Run your own

camp is one of many possible deployments of the same pattern. Want a node that's not subject to anyone else's limits? Clone Amp, run `ampd solo` against your own Arbitrum RPC, drop this gateway in front of it. The whole thing fits on a small VPS or any home server.

## License

MIT. The underlying Amp engine is BUSL-1.1; this gateway consumes its REST output only.
