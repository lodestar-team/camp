# camp roadmap

Not a commitment — a direction. Order roughly reflects what gets shipped first.

**Vision update (2026-05-26):** camp is moving from "an Amp node wrapped in REST" to **a Dune-class data product for Arbitrum** — decoded protocol tables, tip-fresh updates, free and ungated. The Amp source (open on disk now) gives us `evm_decode_log`, `evm_topic`, `eth_call`-in-SQL and the ability to define typed derived datasets. That changes the product surface entirely.

---

## ✅ Phase 1 · Lookups + cheap aggregates against raw tables

Done.

- [x] `GET /v1/status`
- [x] `GET /v1/signatures`
- [x] `GET /v1/transfers` (returns padded-hex `from`/`to`/`amount_hex` — to be upgraded in Phase A)
- [x] `GET /v1/events`
- [x] `GET /v1/block/{n}`
- [x] `GET /v1/tx/{hash}`
- [x] `GET /v1/address/{a}/tx`
- [x] `GET /v1/address/{a}/transfers`
- [x] `GET /v1/gas/blocks` (time-bucketed)
- [x] `GET /v1/contract/{a}/activity` (time-bucketed)

---

## 🚧 Phase A · Decoded protocol data (in progress)

**Why this matters:** This is the wedge against Dune. Their `uniswap_v3.swap_events` decoded tables are most of why analysts use them. Amp's `evm_decode_log` UDF lets us serve the same shape — at tip — for free.

### A1 · Typed responses on existing endpoints
- [ ] `/v1/transfers?decoded=true` — returns typed `from` / `to` / `value` (Decimal128) instead of padded hex topics
- [ ] `/v1/events?decoded_with=<signature>` — when supplied, decode using `evm_decode_log` and return typed fields

### A2 · Graph Horizon decoded dataset
The dataset definition already exists in [`~/amping/amp.config.ts`](../amping/amp.config.ts). Deploy and expose:
- [ ] `GET /v1/horizon/provisions` · `ProvisionCreated`/`ProvisionIncreased`/`ProvisionThawed`/`ProvisionSlashed` decoded
- [ ] `GET /v1/horizon/delegations` · `TokensDelegated`/`TokensUndelegated`/`DelegationSlashed` decoded
- [ ] `GET /v1/horizon/stake` · `HorizonStakeDeposited`/`Locked`/`Withdrawn` decoded
- [ ] `GET /v1/horizon/indexers/{addr}` · combined timeline for one service provider

### A3 · Phase 2 endpoints unblocked
The `arrow_cast(Binary, Decimal128)` block goes away because `evm_decode_log` returns numeric types directly.
- [ ] `GET /v1/token/{a}/volume?bucket=…` · transfer volume per bucket (SUM over decoded `value`)
- [ ] `GET /v1/token/{a}/holders` · approximate holders via Transfer reconstruction
- [ ] `GET /v1/whales/transfers?token=…&min_value=…` · big-Transfer feed
- [ ] `GET /v1/address/{a}/interactions` · which contracts an address touched

### A4 · Two more protocols
Three each: events the protocol cares about. Each is a half-day to define.
- [ ] Uniswap V3 — `swap_events`, `mint_events`, `burn_events`
- [ ] GMX V2 — `trades`, `funding_events`, `liquidations`

---

## 🎨 Phase B · Dashboard / explore UI

Server-rendered pages that demo what the API can do. No client-side query playground yet.

- [ ] `/explore` — index page listing dashboards
- [ ] `/explore/horizon` — live slashing feed, delegation flow, top indexers
- [ ] `/explore/gas` — real-time gas / base-fee chart
- [ ] `/explore/whales` — big Transfer ticker across major tokens
- [ ] OG / share images for each dashboard

---

## ⚙️ Phase C · Tokens, raw SQL, streaming

This is when camp becomes a platform, not just an API.

**Reframed 2026-05-26 after reading amp-typescript + amp source:** Amp already
ships streaming + reorg detection + CDC events natively. We don't *build*
streaming — we *expose* what's already there. Set `amp-stream: true` on a
Flight query → Amp pushes Insert/Delete + reorg events. Our job is the
SSE/WebSocket envelope, not the engine.

### C1 · Tokens
- [ ] Anonymous tokens auto-issued on first request, stored client-side
- [ ] Per-token sliding-window + scan-byte budget
- [ ] Higher-tier tokens with bigger budgets (email signup)

### C2 · Raw query layer (behind tokens)
- [ ] `POST /v1/sql` · raw `SELECT`, allowlisted, with required `block_num` filter, hard `LIMIT 1000`, 8s timeout, scan-byte cost tracked
- [ ] CSV / Arrow IPC response formats
- [ ] OpenAPI spec + auto-generated TS client (`@camp/client`)

### C3 · Streaming — expose Amp's CDC + ProtocolStream
- [ ] `GET /v1/stream/horizon/{event}` · SSE wrapping Amp's CDC stream over a decoded Horizon table — Insert / Delete / Reorg events
- [ ] `GET /v1/stream/transfers?token=…` · live token-transfer push
- [ ] `GET /v1/stream/whales?token=…&min_value=…` · filtered whale push
- [ ] `GET /v1/stream/sql?q=…` (token-gated) · stream any subscribed query
- [ ] Webhooks · `POST` to your URL when a matching event arrives (built on top of CDC)
- [ ] `amp-resume` watermark support — clients can reconnect from a last-seen block hash

### C4 · Discovery
- [ ] `/v1/datasets` proxy of Amp's RegistryApi — list deployed datasets + their schemas
- [ ] `/v1/datasets/{namespace}/{name}` · dataset detail (tables, fields, manifest hash)

---

## 🧰 Infra / engine

- [x] Self-hosted Redis for IP rate limiting (`/srh/` on the tunnel)
- [x] Hourly reindex timer to work around v0.0.35 compactor bug
- [x] Flight-shim written (drop-in replacement for the v0.0.36-removed JSONL endpoint)
- [ ] Switch nginx to use the Flight shim
- [ ] Upgrade ampd v0.0.35 → v0.0.36 (compactor works there)
- [ ] Drop the hourly reindex timer once compactor is verified
- [ ] Add per-token cost-based rate limiting (gates Phase C)
- [ ] Backfill more than just "since last reindex" — full Arbitrum history for the protocols we care about

## 🔭 Optional / opportunistic

These are nice-to-haves we'd pick up if a specific user need pushed us toward them.

- [ ] USD price ingestion (oracle feed → joined view) — `eth_call` UDF means we could do this *inside SQL* against a Chainlink feed
- [ ] ENS reverse lookup
- [ ] An indexer / dashboard for `camp` itself — query stats, popular endpoints
- [ ] A second chain (only after Arbitrum protocol coverage is real)

---

## What's deliberately NOT on the roadmap

- Token balances by reading state via RPC outside SQL. We can do it *via* `eth_call` in SQL, but we don't offer a pure-balance endpoint.
- Forking ampd. We have the source for understanding; modifying only if we hit a specific patch-able blocker.
- Multi-tenant dashboards / SaaS login. camp is a data API. Use Grafana / Hex / Metabase against the SQL endpoint when it exists.
- Free-tier limits beyond DoS protection. We don't have a paid tier; per-IP and per-token budgets are about protecting the laptop, not monetizing.
