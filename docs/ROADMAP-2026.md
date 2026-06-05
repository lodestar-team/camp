# camp — 2026 roadmap

*The strategic roadmap for 2026. Leverage-ranked, not a feature checklist (see
[`ROADMAP.md`](../ROADMAP.md) for the shipped-features log). Order reflects
value-per-effort, deliberately steering away from the engine swap — none of the
highest-value moves require it.*

Snapshot when written (2026-06-04, history note revised 2026-06-05): ~6,950 LOC,
33 endpoints, 10 dashboards, 2 decoded protocols (Horizon + Uniswap V3), Arbitrum
One only, ~tip lag 7s, single ThinkPad. History accumulates on its own as ampd
tip-follows (no retention cap) — no backfill planned; see below.

---

## The framing

"Improve camp" = three jobs: **make people trust it**, **make it cover more**,
**make it sticky**. The engine/license debate (ampd is BUSL-1.1) is real but
*not* the lever — see [Engine & license stance](#engine--license-stance).

---

## History window: let it accumulate, don't backfill (unless deadline-driven)

**Status: decided 2026-06-05 — we wait.** The earlier plan ("backfill to 3 months,
it's the #1 move") was over-engineered. **ampd has no age-based retention** (verified
against source: no `retention`/`max_age`/`ttl`/`rolling` anywhere; the collector/
`gc_manifest` only reaps *orphaned/superseded* files, never live data by age). So as
ampd tip-follows, **history grows ~1 day per day, for free** — ~90 MB/day, so 90 days
≈ 8 GB, a year ≈ 33 GB on a 1.9 TB disk. The window deepens itself with zero RPC cost
and zero risk. In ~90 days of uptime you simply *have* 90 days.

A backfill buys exactly one thing: **depth *now* instead of *later*.** That is rarely
worth it — and reaching for it is precisely what **caused the 2026-06-05 outage**
(destructive wipe-and-reindex blanked the live tip for ~2 days). Default action:
**do nothing; let it accumulate.** Stop running destructive reindexes.

**The only justification to backfill is a deadline** where you need real historical
depth live *before* a date the natural fill won't reach. The one real candidate is the
**Sim sunset (Aug 1)** — waiting from June only yields ~2 shallow months by then, so
*if* camp wants to court Sim-migrating users with real history at that moment, a
one-time backfill before August is justified. Otherwise, skip it.

### If you ever DO backfill: zero-downtime only

Never wipe the live window again. Use the side-range-backfill + atomic-cutover flow
(`~/amping/deploy/reindex-zerodt.sh` → `cutover.sh` → `gc-version.sh`): deploy a new
version that backfills *beside* the live one, repoint `AMP_DATASET` only once it's
caught up to head, then GC the old version. Notes baked into the scripts:
- `rpc_batch_size = 10` in the provider config (50 AND 100 both trip Arbitrum
  `-32003 response too large` on full blocks+receipts); throughput ceiling ~80 blk/s.
- The API pins a specific `AMP_DATASET` version tag — the cutover script repoints it
  (Vercel env + `.env.local` + redeploy) so the API never queries a dead version.
  (The silent-outage trap: aggregates read footer stats so `/v1/status` looks fine
  while every row fetch 500s with `parquet ... not found`.)
- Next throughput lever, if a backfill ever needs to be faster, is a 2nd RPC provider
  (round-robin), not more disk.

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

**immutable caching → status page → SDKs.** ~a week of work, touches neither the
engine nor the license argument, and it's the difference between "neat free toy"
and "thing I'd actually build on." History is no longer on this list — it deepens
itself as ampd tip-follows, so the move is *patience*, not a backfill (the only
exception being a deadline like the Sim sunset; see the history section above).
