# camp — 2026 roadmap

*The strategic roadmap for 2026. Leverage-ranked, not a feature checklist (see
[`ROADMAP.md`](../ROADMAP.md) for the shipped-features log). Order reflects
value-per-effort, deliberately steering away from the engine swap — none of the
highest-value moves require it.*

Snapshot when written (2026-06-04): ~6,950 LOC, 33 endpoints, 10 dashboards,
2 decoded protocols (Horizon + Uniswap V3), Arbitrum One only, ~tip lag 7s,
single ThinkPad, history window being extended from ~days → 6 months.

---

## The framing

"Improve camp" = three jobs: **make people trust it**, **make it cover more**,
**make it sticky**. The engine/license debate (ampd is BUSL-1.1) is real but
*not* the lever — see [Engine & license stance](#engine--license-stance).

---

## The single highest-leverage move: kill the short history window

**Status: in progress (2026-06-04).** The short window is what makes camp read
as a *toy* next to Dune — no real historical analytics. It is **not an engine
limit, it's a retention/start-block config**. Disk is at 14% of 1.9 TB
(~1.6 TB free); ~7.8 GB per million blocks → 6 months (~63 M blocks) ≈ 350–490 GB,
fits comfortably. Backfilling to a 6-month window is the biggest
credibility-per-hour move available. (Backfill = wipe + re-index from
`tip − 183d`; costs ~1–2 days of degraded tip-freshness while it crawls to head.)

## Tier 1 — days, engine-agnostic, trust/adoption

1. **Immutable-history caching.** Data older than tip is immutable. Split the
   Vercel edge cache: tip-adjacent → short TTL; historical → `max-age=1y,
   immutable`. Today it's a blanket ~30s revalidate. Big latency + cost win.
2. **Status / trust page.** Surface `/v1/status` (≈7 s tip lag, 177 ms) as a
   `/status` page with uptime history + published freshness/latency SLOs. People
   won't build on a single-box free API whose health they can't see.
3. **SDKs from the OpenAPI 3.1 spec.** `openapi-typescript` + `openapi-python-client`
   → publish `camp-ts` / `camp-py`. Turns curl users into integrators.
4. **`/v1/sql` cookbook + caveats doc.** Document the Flight-shim papercuts:
   `CAST(col AS T) AS col` silently returns 0 rows (alias to a different name);
   `arrow_cast(Binary, Decimal128)` is rejected (no server-side SUM on raw value
   bytes); `evm_decode_log` returns a struct-of-Utf8 (bracket-access + cast to
   Decimal128 for arithmetic). Ideally patch the shim too.

## Tier 2 — weeks, expands the audience

5. **Second chain: Base.** ampd is multi-chain by config (not coupled to the
   engine swap). Base = biggest L2 dev crowd. Provider manifest + namespace.
6. **Capture the Sim sunset (2026-08-01).** Add the wallet primitives Sim users
   will lose: `/v1/address/{a}/balances`, `/v1/token/{a}/holders`, and **USD
   pricing** (DEX-pool/oracle join — the hard part). Write a "migrating off Sim"
   guide before the date.
7. **Open decoding registry.** Formalize "drop an ABI + manifest → decoded
   endpoints." Add ERC-20/721/1155 standard decoding + Arbitrum-native protocols
   (Camelot, Aave, Lodestar). Spellbook-style community PRs = coverage that scales.

## Tier 3 — months, becomes a backend people build on

8. **Event-level CDC streaming + webhooks.** Extend `/v1/stream/blocks` (SSE) to
   reorg-aware *event* streams + webhook push. The jump from query tool → backend.
9. **Derived/materialized tables + dataset versioning.**
10. **BI connectors** (Grafana, Metabase) over `/v1/sql`.

## The reliability elephant

The ThinkPad **is** camp — single point of failure. Before anyone serious bets a
product on it: a documented restore path at minimum, ideally a read replica
behind the columnar store. Gate on "can I depend on this."

---

## Engine & license stance

- ampd is **BUSL-1.1** (Edge & Node). camp's gateway/decoding layer is MIT, so
  the strict "100% OSI open source, top to bottom" claim is **not accurate** —
  fix the marketing wording (e.g. "MIT gateway + open decoding layer over a
  source-available engine; BUSL→Apache-2.0 in ≤3y").
- The actual **Additional Use Grant** (read from `~/amp-source/LICENSE`) expressly
  states *"Products that are not provided on a paid basis … are not competitive."*
  camp is free → production use is **permitted**. The "legal exposure" alarm is
  largely defused — *as long as camp stays free*.
- **Bright line:** the moment we charge for the ampd-powered surface, we exit the
  free carve-out and the competitive-offering clause bites. So **keep the
  ampd-powered API free**; any paid tier must not be the ampd surface.
- **Engine independence = long-term hedge, not emergency.** Real reasons to reduce
  the ampd dependency: future rug-pull/terms-change risk, and preserving the
  *option* to ever monetize. Path: build a shadow cryo (Apache-2.0) + DataFusion-
  over-Parquet pipeline to prove parity, keep ampd live, cut over only if the risk
  calculus changes. Note this is a large rebuild (loses ampd's in-engine EVM decode
  UDFs, tip-follower, compactor) — not the "low-effort" it's sometimes framed as.
  A reth/Alloy ExEx verifiable core is a north star, but Arbitrum is Nitro, not
  reth, so it's not a near-term drop-in.

---

## If it were me, in order

**history window → immutable caching → status page → SDKs.** ~a week of work,
touches neither the engine nor the license argument, and it's the difference
between "neat free toy" and "thing I'd actually build on."
