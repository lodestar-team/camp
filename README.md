# camp

Free Dune-class data API for Arbitrum One — decoded protocol events, tip-fresh, no signup.

Built on a self-hosted **Amp** node. The pitch in one line: same query shape Dune offers (decoded protocol tables), but updated at chain tip and free.

Live at **https://camp.cargopete.com**.

See [src/app/page.tsx](src/app/page.tsx) for the public-facing landing page (endpoint catalog, rate limits, scope).

## Endpoints

### Lookups & queries

| Method | Path | Purpose |
|---|---|---|
| GET | `/v1/status` | Latest indexed block + indexed-block count |
| GET | `/v1/signatures` | Reference of well-known event topic0s |
| GET | `/v1/transfers?token=…&from_block=…&to_block=…` | ERC-20 / 721 Transfer events, decoded (`from`/`to`/`value`) |
| GET | `/v1/events?address=…&topic0=…&topic1..3=…&from_block=…&to_block=…` | Generic log filter |
| GET | `/v1/block/{n}` | Full block: header + every tx + every log |
| GET | `/v1/tx/{hash}?from_block=…&to_block=…` | Transaction + its logs (default window: last 100 k blocks) |
| GET | `/v1/address/{a}/tx?direction=from\|to\|all` | Transactions where address is `from`/`to` |
| GET | `/v1/address/{a}/transfers?direction=in\|out\|all&token=…` | Token movements in/out, optional token filter |
| GET | `/v1/address/{a}/interactions` | Distinct contracts an address called |

### Aggregates

| Method | Path | Purpose |
|---|---|---|
| GET | `/v1/gas/blocks?bucket=minute\|hour\|day` | Gas / base-fee / throughput time-series |
| GET | `/v1/contract/{a}/activity?bucket=…` | Log-count time-series per contract |
| GET | `/v1/token/{a}/volume?bucket=…` | Token transfer volume per bucket |
| GET | `/v1/whales/transfers?token=…&min_value=…` | Big-Transfer feed for any token |

### Decoded protocols

| Method | Path | Purpose |
|---|---|---|
| GET | `/v1/horizon` | Catalog of supported Horizon events |
| GET | `/v1/horizon/{event}` | 12 decoded Horizon staking events (provisions, delegations, slashing, …) |
| GET | `/v1/uniswap-v3` | Catalog |
| GET | `/v1/uniswap-v3/{event}?pool=…` | Decoded Uniswap V3 `swap`, `mint`, `burn` per pool |

### Raw SQL, streams, discovery

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/sql` | DataFusion-flavoured `SELECT` against the indexed tables (allowlisted, must include `block_num` filter) |
| GET | `/v1/sql` | Surface description: tables, UDFs, contract |
| GET | `/v1/datasets` | Full programmatic surface — raw + decoded + lookups + aggregates |
| GET | `/v1/stream/blocks` | Server-Sent Events: new blocks as they're indexed |

Server-side caps: block span ≤ 100,000 · rows ≤ 1,000 · query timeout 8 s. Rate limit: 30/min · 500/hour per IP. Edge cache: 1 h for finalized ranges, 5 s near tip.

OpenAPI 3.1 spec at [`/openapi.yaml`](https://camp.cargopete.com/openapi.yaml); browsable reference at [`/docs`](https://camp.cargopete.com/docs).

## Dashboards

[`/explore`](https://camp.cargopete.com/explore) hosts server-rendered pages that demo what the API can do:

- [`/explore/sql`](https://camp.cargopete.com/explore/sql) — Dune-style SQL playground with canned examples
- [`/explore/gas`](https://camp.cargopete.com/explore/gas) — live base-fee + throughput charts
- [`/explore/whales`](https://camp.cargopete.com/explore/whales) — live big-Transfer ticker, token switcher
- [`/explore/horizon`](https://camp.cargopete.com/explore/horizon) — Graph Horizon timeline with severity accents

## Architecture

```
client
  ↓
camp.cargopete.com                  (edge: TLS, DDoS, CDN cache)
  ↓
Cloudflare Quick Tunnel             (private origin link;
  ↓                                  URL auto-rotates and re-syncs to Vercel env)
nginx :1604                         (shared-secret + Redis rate limit)
  ├─ /         → ampd JSONL :1603   (token-gated SQL)
  ├─ /srh/     → Redis HTTP shim    (rate-limit state)
  └─ /healthz
  ↓
ampd  (Arbitrum One indexer; parquet on local SSD)
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

Tracking the bigger plan in [ROADMAP.md](ROADMAP.md). Where we are:

- **Phase 1** ✅ Lookups + cheap aggregates over raw tables
- **Phase A** ✅ Decoded protocol data — Graph Horizon (12 events) + Uniswap V3 (swap/mint/burn) via `evm_decode_log`
- **Phase B** ✅ `/explore` dashboards — SQL playground, gas, whales, Horizon timeline
- **Phase C** ✅ Raw `POST /v1/sql`, `/v1/datasets` catalog, `/v1/stream/blocks` SSE
- **Next** Anonymous tokens for higher per-user limits, GMX V2 (EventEmitter decoding), CSV / Arrow IPC export, webhooks.

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
