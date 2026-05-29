# camp: free, tip-fresh, decoded Graph Horizon data on Arbitrum One

*A community Amp node serving decoded protocol events over a small REST API — no signup, no API key. This post is a deep dive aimed squarely at the people in this forum: indexers, delegators, and anyone who's ever tried to pull Horizon staking history and ended up writing their own subgraph at 2am.*

**Live:** https://camp.cargopete.com · **Source (MIT):** https://github.com/lodestar-team/camp

---

## TL;DR

- camp is a free REST API over an **Amp** node indexing **Arbitrum One** at chain tip.
- It serves **12 decoded Graph Horizon staking events** — provisions, delegations, stake, and slashing — with full `uint256` precision, addresses already un-padded, no ABI required on your end.
- Everything is one bounded SQL query under the hood. There's also a **raw `POST /v1/sql`** escape hatch if the canned endpoints don't cut it.
- It's a community service: free, no SLA, rate-limited per IP. If you need guaranteed latency, the whole stack is open — run your own in an afternoon.

If you just want to see decoded Horizon data right now:

```bash
# Latest indexed block first, so you know your range
curl https://camp.cargopete.com/v1/status

# Then: recent ProvisionCreated events (replace the block range with a recent ~10k window)
curl "https://camp.cargopete.com/v1/horizon/provision-created?from_block=466940000&to_block=466950000&limit=20"
```

---

## The problem this solves

Horizon staking data lives in event logs on the `HorizonStaking` contract on Arbitrum One (`0x00669a4cf01450b64e8a2a20e9b1fcb71e61ef03`). Getting at it usually means one of:

1. **Run an archive node + write decode logic.** Works, but it's your infra, your ABI plumbing, your `uint256`-in-JavaScript precision bugs.
2. **Write a subgraph.** Great for production dapps, heavy for "I just want to see every slashing event this week."
3. **Use a hosted analytics product.** Often gated, often lagging the tip by minutes-to-hours, often not free.

camp is the fourth option: a public endpoint where `GET /v1/horizon/provision-slashed?from_block=…&to_block=…` returns clean, typed JSON, updated at chain tip, for free. It's deliberately narrow — raw indexed event history and lookups, not a balances/pricing/analytics platform — and that narrowness is what keeps it fast and cheap to run.

---

## What's actually decoded (the Horizon surface)

camp exposes a catalog at `GET /v1/horizon`, then one endpoint per event at `GET /v1/horizon/{slug}`. The twelve events currently covered:

| Slug | Event | Notable fields |
|---|---|---|
| `horizon-stake-deposited` | `HorizonStakeDeposited` | `serviceProvider`, `tokens` |
| `horizon-stake-locked` | `HorizonStakeLocked` | `serviceProvider`, `tokens`, `until` |
| `horizon-stake-withdrawn` | `HorizonStakeWithdrawn` | `serviceProvider`, `tokens` |
| `provision-created` | `ProvisionCreated` | `serviceProvider`, `verifier`, `tokens`, `maxVerifierCut`, `thawingPeriod` |
| `provision-increased` | `ProvisionIncreased` | `serviceProvider`, `verifier`, `tokens` |
| `provision-thawed` | `ProvisionThawed` | `serviceProvider`, `verifier`, `tokens` |
| `tokens-deprovisioned` | `TokensDeprovisioned` | `serviceProvider`, `verifier`, `tokens` |
| `provision-slashed` | `ProvisionSlashed` | `serviceProvider`, `verifier`, `tokens` |
| `tokens-delegated` | `TokensDelegated` | `serviceProvider`, `verifier`, `delegator`, `tokens`, `shares` |
| `tokens-undelegated` | `TokensUndelegated` | `serviceProvider`, `verifier`, `delegator`, `tokens`, `shares` |
| `delegated-tokens-withdrawn` | `DelegatedTokensWithdrawn` | `serviceProvider`, `verifier`, `delegator`, `tokens` |
| `delegation-slashed` | `DelegationSlashed` | `serviceProvider`, `verifier`, `tokens` |

Every response gives you `block_num`, `log_index`, `tx_hash`, and the decoded fields. Addresses arrive as proper `0x…` (already un-padded from their 32-byte topic form). Numeric fields — including `uint256` `tokens`/`shares` amounts — come back as **decimal strings**, deliberately, so they survive the JSON round-trip without getting mangled by JavaScript's 53-bit `Number`. Parse them with your bigint library of choice.

> One honest caveat: `DelegationFeeCutSet` isn't in the set yet — it carries a `uint8 indexed` parameter that needs separate topic handling, so it was left out of the v0 cut to keep every event on the same projection shape. On the list.

---

## How to query it

Every event endpoint takes the same parameters:

- `from_block` / `to_block` — **required**, span ≤ 100,000 blocks.
- `limit` — optional, default 100, max 1,000.
- Optional **indexed-address filters** by field name: `serviceProvider`, `verifier`, `delegator`. These are matched cheaply against `topic1..topic3` *before* decoding, so filtering by them is essentially free.

### All delegations to one indexer

```bash
curl "https://camp.cargopete.com/v1/horizon/tokens-delegated\
?serviceProvider=0xYOUR_INDEXER_ADDRESS\
&from_block=466900000&to_block=466950000&limit=100"
```

```json
{
  "event": "TokensDelegated",
  "count": 2,
  "events": [
    {
      "block_num": 466948210,
      "log_index": 14,
      "tx_hash": "0x…",
      "serviceProvider": "0x…",
      "verifier": "0x…",
      "delegator": "0x…",
      "tokens": "5000000000000000000000",
      "shares": "4987120000000000000000"
    }
  ]
}
```

### Every slashing event in a window

```bash
curl "https://camp.cargopete.com/v1/horizon/provision-slashed\
?from_block=466900000&to_block=466950000&limit=100"
```

Pair it with `delegation-slashed` to see how a slash split across the provision and its delegation pool.

### A delegator's full footprint

Filter `tokens-delegated`, `tokens-undelegated`, and `delegated-tokens-withdrawn` by `delegator=0x…` to reconstruct a delegator's lifecycle across any indexer.

---

## When the canned endpoints aren't enough: raw SQL

The decoded endpoints cover the common questions, but Horizon analytics often means *aggregation* — "total tokens delegated per day", "top 10 most-slashed provisions". For that there's `POST /v1/sql`: a guarded DataFusion `SELECT` straight against the indexed `logs` table, with the same decode UDFs the endpoints use internally.

```bash
curl -X POST https://camp.cargopete.com/v1/sql \
  -H "Content-Type: text/plain" \
  --data 'SELECT date_trunc('"'"'day'"'"', timestamp) AS day,
       COUNT(*) AS delegations
FROM "_/arbitrum_one@2.0.0".logs
WHERE block_num BETWEEN 466900000 AND 466990000
  AND address = X'"'"'00669a4cf01450b64e8a2a20e9b1fcb71e61ef03'"'"'
  AND topic0  = evm_topic('"'"'TokensDelegated(address,address,address,uint256,uint256)'"'"')
GROUP BY 1
ORDER BY 1'
```

The UDFs available inside SQL:

- `evm_topic('Sig(types)')` — derive a `topic0` from a canonical event signature.
- `evm_decode_log(topic1, topic2, topic3, data, 'Sig(...)')` — decode a log row into a typed struct; access fields with `d['fieldName']`.
- plus `evm_decode_params` / `evm_encode_params` / `evm_decode_type` / `evm_encode_type` for calldata work.

The guard rails: `SELECT`-only, every query **must** reference `block_num` (so the scan is always bounded), a hard `LIMIT 1000` is injected if you omit it, 8s server-side timeout, and no comments/multi-statements/DDL/file-IO. `GET /v1/sql` returns the full self-describing contract — tables, UDFs, and a worked example.

There's also a **Dune-style SQL playground** in the browser at https://camp.cargopete.com/explore/sql if you'd rather click than curl, and a decoded Horizon timeline (with severity accents on slashing events) at https://camp.cargopete.com/explore/horizon.

---

## How it works under the hood

camp is the public Vercel gateway in front of a self-hosted **Amp** node. Amp is the interesting bit: it indexes raw chain data into compacted parquet and ships SQL-native EVM decoding (`evm_decode_log`, `evm_topic`, even `eth_call`-in-SQL) as DataFusion UDFs. So "decoded Horizon tables" aren't a bespoke ETL pipeline — they're a parameterised query against `logs`, resolved at request time.

```
client
   │
   ▼
camp.cargopete.com            edge: TLS · DDoS · CDN response cache
   │
   ▼
Cloudflare tunnel             private link to the origin
   │
   ▼
nginx                         shared-secret auth + per-IP rate limit (Redis)
   │
   ▼
ampd (Arbitrum One)           parquet on local SSD, compactor active, indexing at tip
```

Every public endpoint maps to a **single bounded SQL query**. Block-range, address, and topic filters are enforced server-side, so the chain stays the bottleneck rather than the gateway. Finalized ranges are edge-cached for an hour; near-tip queries for five seconds.

**Data freshness:** the indexed window rebuilds forward from **2026-05-27** (a clean cutover after an ampd engine upgrade whose metadata schema wasn't downgrade-safe) and grows ~24h every calendar day until it caps at a rolling ~30 days. Live depth is on every `/v1/status` response (`history_seconds`, `earliest_indexed_at`), so you can always check coverage before you query.

---

## Fair use

It's a community service offered free, with no SLA. The contract, identical for everyone:

| | |
|---|---|
| Max block span per request | 100,000 |
| Max rows per response | 1,000 |
| Server-side query timeout | 8 s |
| Rate limit per IP | 30 / min · 500 / hour |
| Edge cache | 1 h finalized · 5 s near tip |

The limits are calibrated so a normal dashboard or bot has plenty of headroom while abuse hits the wall first. Work *with* the cache and the rate limit, not around them. If you're building something that needs chain data at a guaranteed latency, please run your own node — which brings us to:

## Run your own

camp is one deployment of a repeatable pattern. The dataset config, the indexer, and this gateway are all open. Clone Amp, run `ampd solo` against your own Arbitrum RPC, drop the gateway in front, and you've got your own ungated node on a small VPS or a home server. No permission required, no rate limit but your own.

---

## What's next (and where this forum comes in)

The decoded-protocol surface today is Graph Horizon (12 events) and Uniswap V3 (swap/mint/burn). On the roadmap: anonymous tokens for higher per-user limits, CSV / Arrow IPC export, and CDC-style streaming/webhooks.

What I'd genuinely like input on from this community:

- **Which Horizon events or aggregations are missing?** `DelegationFeeCutSet` is already queued — what else would you actually use? Per-indexer delegation time-series? Slashing leaderboards? A `/v1/horizon/provision/{indexer}` rollup?
- **Is tip-freshness or history depth the bigger constraint** for your use case? The rolling-30d window is a deliberate trade-off; happy to revisit if there's demand for deeper backfill of Horizon specifically.

Bug reports, feature requests, and "this query returned something weird" reports all welcome at https://github.com/lodestar-team/camp/issues.

---

*Built on Amp. MIT-licensed gateway. Not affiliated with The Graph core teams — just a community node pointed at the data this forum cares about.*
