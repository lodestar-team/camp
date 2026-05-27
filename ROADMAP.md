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

## ✅ Phase A · Decoded protocol data

This was the wedge against Dune — their `uniswap_v3.swap_events` decoded tables are most of why analysts use them. Now ours, at tip, for free.

### A1 · Typed responses on existing endpoints
- [x] `/v1/transfers` — typed `from` / `to` / `value` via `evm_decode_log`
- [x] `/v1/events` — generic log filter (raw shape; per-event decoded endpoints below cover the typed surface)

### A2 · Graph Horizon decoded dataset
- [x] `GET /v1/horizon` — catalog
- [x] `GET /v1/horizon/{event}` — 12 dispatched events covering provisions, delegations, stake, and slashing

### A3 · Phase 2 endpoints unblocked
The `arrow_cast(Binary, Decimal128)` block went away because `evm_decode_log` returns numeric types directly.
- [x] `GET /v1/token/{a}/volume?bucket=…` · transfer volume per bucket
- [x] `GET /v1/whales/transfers?token=…&min_value=…` · big-Transfer feed
- [x] `GET /v1/address/{a}/interactions` · which contracts an address touched
- [ ] `GET /v1/token/{a}/holders` · approximate holders via Transfer reconstruction *(deferred)*

### A4 · More protocols
- [x] Uniswap V3 — `swap`, `mint`, `burn`
- [ ] GMX V2 — `trades`, `funding_events`, `liquidations` *(deferred — EventEmitter pattern needs different decoding)*

---

## ✅ Phase B · Dashboard / explore UI

Server-rendered pages that demo what the API can do.

- [x] `/explore` — index, with live blocks panel
- [x] `/explore/horizon` — timeline of decoded Horizon events with severity accents
- [x] `/explore/gas` — base-fee + throughput SVG charts
- [x] `/explore/whales` — big-Transfer ticker, token + min-value switcher
- [x] `/explore/sql` — Dune-style SQL playground (canned examples, ⌘+↩ to run)
- [ ] OG / share images for each dashboard *(deferred)*

---

## ⚙️ Phase C · Tokens, raw SQL, streaming

camp graduates from API to platform.

**Reframed 2026-05-26 after reading amp-typescript + amp source:** Amp already
ships streaming + reorg detection + CDC events natively. We don't *build*
streaming — we *expose* what's already there.

### C1 · Tokens *(deferred — no immediate abuse pressure)*
- [ ] Anonymous tokens auto-issued on first request, stored client-side
- [ ] Per-token sliding-window + scan-byte budget
- [ ] Higher-tier tokens with bigger budgets (email signup)

### C2 · Raw query layer
- [x] `POST /v1/sql` · raw `SELECT`, allowlisted, with required `block_num` filter, hard `LIMIT 1000`, 8s timeout
- [x] `GET /v1/sql` · self-describing contract (tables, UDFs, examples)
- [ ] CSV / Arrow IPC response formats
- [ ] OpenAPI spec + auto-generated TS client (`@camp/client`)

### C3 · Streaming
- [x] `GET /v1/stream/blocks` · SSE pseudo-stream of new blocks (2 s poll, 5 min cap)
- [ ] Native Amp CDC bridge once Flight shim is wired in (Insert / Delete / Reorg events)
- [ ] `GET /v1/stream/transfers?token=…` · live token-transfer push
- [ ] `GET /v1/stream/whales?token=…&min_value=…` · filtered whale push
- [ ] `GET /v1/stream/sql?q=…` · stream any subscribed query
- [ ] Webhooks · `POST` to your URL when a matching event arrives
- [ ] `amp-resume` watermark support

### C4 · Discovery
- [x] `/v1/datasets` · full programmatic surface (raw + decoded + lookups + aggregates)
- [ ] `/v1/datasets/{namespace}/{name}` · dataset detail proxying Amp's RegistryApi

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
