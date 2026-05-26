# camp roadmap

Not a commitment — a direction. Order roughly reflects what gets shipped first.

---

## Phase 1 · More lookups against existing data

These all run on what's already indexed (`blocks`, `transactions`, `logs`) — no new ingestion needed.

- [x] `GET /v1/status` · sync state
- [x] `GET /v1/signatures` · known event topic0s
- [x] `GET /v1/transfers` · Transfer events for an ERC-20/721 token
- [x] `GET /v1/events` · generic log filter
- [ ] `GET /v1/block/{n}` · full block with every tx + log
- [ ] `GET /v1/tx/{hash}` · transaction + receipt + decoded transfers
- [ ] `GET /v1/address/{a}/tx` · transactions where this address is `from` or `to`
- [ ] `GET /v1/address/{a}/transfers` · token movements in and out of an address
- [ ] `GET /v1/gas/blocks?bucket=1m` · time-bucketed gas / base-fee / throughput stats
- [ ] `GET /v1/contract/{a}/activity?bucket=1h` · log-count time-series for a contract
- [ ] `GET /v1/whales/transfers?token=…&min_value=…` · big-Transfer feed

## Phase 2 · Aggregates that need SQL primitive work

These depend on DataFusion features that need verification against ampd before we promise them.

- [ ] `GET /v1/token/{a}/volume?bucket=1h` · token transfer volume (requires safe SUM on 32-byte `data` field)
- [ ] `GET /v1/token/{a}/holders` · approximate holders via Transfer reconstruction (expensive aggregate)
- [ ] `GET /v1/address/{a}/interactions` · which contracts an address touched

## Phase 3 · Tokens, then arbitrary SQL

Until callers have an identity beyond an IP we can't safely expose raw SQL — any one query could OOM ampd. With tokens we can throttle by *cost* instead of count and open the gates.

- [ ] Anonymous tokens auto-issued on first request, stored client-side
- [ ] Per-token sliding-window + scan-byte budget
- [ ] `POST /v1/sql` · raw `SELECT`, allowlisted, with required `block_num` filter, hard `LIMIT 1000`, 8s timeout, scan-byte cost tracked
- [ ] Higher-tier tokens (email signup) with bigger budgets

## Phase 4 · Decoded protocol tables

The biggest gap to Dune-class usefulness on this chain. Each decoded dataset is a small declarative addition to `amp.config.ts` on the indexer side.

- [ ] Uniswap V3 swaps, pools, liquidity events
- [ ] Uniswap V2 swaps
- [ ] Aave V3 borrow / supply / liquidation
- [ ] GMX V2 trades + funding
- [ ] Camelot DEX
- [ ] Stargate / LayerZero bridge flows
- [ ] Graph Horizon staking (already partly defined in the indexer repo)
- [ ] USDC / USDT / DAI / WETH / GRT — decoded Transfer/Approval tables per token
- [ ] Top-10 NFT collections by Arbitrum volume

Each gets a typed endpoint family: `/v1/uniswap-v3/swaps?pool=…`, etc.

## Phase 5 · Composition + UX

What makes Dune sticky isn't the SQL, it's the graph of saved queries and shared dashboards.

- [ ] Saved queries with stable share URLs · `GET /q/{slug}` returns the latest result
- [ ] Result formats: JSON (default) · JSONL · CSV · Apache Arrow IPC
- [ ] Webhooks · POST your URL when a filter matches a new log
- [ ] SSE / WebSocket subscriptions for live filters
- [ ] OpenAPI spec + auto-generated TS client (`@camp/client`)
- [ ] Minimal in-browser query playground at `/q`

## Phase 6 · Wider lens

- [ ] Optional USD price ingestion (oracle feed → Postgres → JOIN-able view)
- [ ] ENS reverse lookup + address labels
- [ ] A second chain (only if it's clear we won the Arbitrum niche first)

---

## What's deliberately NOT on the roadmap

- **Token balances by reading state** — we have events, not state. Anyone who needs current balance should call the RPC directly.
- **Decoded calldata for arbitrary transactions** — 4byte / Etherscan resolution is a separate problem space, and the value is marginal here.
- **Pre-genesis history** — we backfill on request, but the default is "from when this node was deployed."
- **Multi-tenant dashboards / login** — camp is a data API, not a SaaS product. If you want dashboards, run a Grafana / Hex / Metabase against the SQL endpoint when it exists.
