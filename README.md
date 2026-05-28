# camp

**Free Dune-class data API for Arbitrum One.** Decoded protocol events, indexed at chain tip, no signup, no API key, no quota dashboard. Same query shape Dune offers (decoded protocol tables) — but live and free.

Live at **https://camp.cargopete.com**.

📖 Background reads: [intro to camp](https://www.lodestar-dashboard.com/blog/camp-free-amp-api-arbitrum) · [camp deep dive](https://www.lodestar-dashboard.com/blog/camp-deep-dive)

See [src/app/page.tsx](src/app/page.tsx) for the public-facing landing page.

---

## Quickstart

Three lines that get you something useful, with no setup:

```bash
# 1) Where is the chain tip?
curl https://camp.cargopete.com/v1/status

# 2) USDC Transfer events in a 1,000-block window
curl "https://camp.cargopete.com/v1/transfers\
?token=0xaf88d065e77c8cc2239327c5edb3a432268e5831\
&from_block=467200000&to_block=467201000&limit=20"

# 3) Raw SQL — anything DataFusion accepts, as long as it filters on block_num
curl -X POST https://camp.cargopete.com/v1/sql \
  -H "Content-Type: text/plain" \
  --data 'SELECT block_num, gas_used
          FROM "_/arbitrum_one@2.0.0".blocks
          WHERE block_num BETWEEN 467200000 AND 467200100
          ORDER BY block_num DESC'
```

No key, no signup. Anonymous limits: 30 req/min · 500 req/hour per IP. Per-request caps: 100,000 block span · 1,000 rows · 8 s server-side timeout. Edge cache: 1 h for finalized ranges, 5 s near tip.

---

## Higher limits — anonymous bearer tokens

For dashboards, bots, and indexers that bump the anonymous tier, mint a token (no signup, no PII):

```bash
curl -X POST https://camp.cargopete.com/v1/tokens
# → { "token": "camp_aifqzj2xs7eb6dgr3qk2eyhwwc25mra4", "limits": { "per_minute": 300, "per_hour": 5000 }, "ttl_seconds": 2592000, ... }

curl https://camp.cargopete.com/v1/status \
  -H "Authorization: Bearer camp_aifqzj2xs7eb6dgr3qk2eyhwwc25mra4"
```

| Tier | Per minute | Per hour | Identifier |
|---|---|---|---|
| anonymous | 30 | 500 | IP |
| token | 300 | 5,000 | token |

- **Token minting** is itself rate-limited to **5 / day per IP** (Sybil deterrent — won't stop a botnet but stops casual abuse).
- **Token lifetime** is **30 days sliding** — every authenticated request refreshes it. Idle tokens self-expire.
- **Curl-friendly alias** if you'd rather not deal with `Authorization`: `X-Camp-Token: camp_<token>`.
- **Inspect your token** at `GET /v1/tokens/me` with the bearer header set.
- **No signup, no PII, no email.** The token is the identity.

---

## What you can build

A few things people are actually building (or could build in an afternoon) on top of camp:

- **Wallet activity tracker** — `/v1/address/{a}/tx`, `/v1/address/{a}/transfers`, and `/v1/address/{a}/interactions` together give you everything Arbiscan shows on a wallet page, but as JSON your code can consume.
- **Whale alert bot** — `/v1/whales/transfers?token=…&min_value=…` returns big Transfer events for any ERC-20. Poll every minute, ping a Discord webhook on new entries.
- **Live gas / throughput chart** — `/v1/gas/blocks?bucket=minute` is a single endpoint that gives you everything you need for a Dune-style gas chart, no SQL required. Or stream new blocks live via `/v1/stream/blocks` (Server-Sent Events).
- **DEX dashboard** — `/v1/uniswap-v3/{event}?pool=…` returns decoded `Swap` / `Mint` / `Burn` per pool, with sender/recipient/amount fields ready to render. The `/explore/uniswap-v3` dashboard in this repo is one example.
- **Staking analytics** — `/v1/horizon/{event}` decodes 12 Graph Horizon events (stake, delegation, slashing, …) — used in production by [Lodestar Dashboard](https://www.lodestar-dashboard.com).
- **Anything Dune does, but tip-fresh** — `POST /v1/sql` accepts arbitrary `SELECT` statements against `blocks` / `transactions` / `logs`. UDFs include `evm_decode_log`, `evm_topic`, `arrow_cast`. Decode any event from any contract, group/aggregate however you want, get JSON back.

The **SQL playground** at [`/explore/sql`](https://camp.cargopete.com/explore/sql) lets you run all of these straight from the browser.

---

## Endpoints

### Auth

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/tokens` | Mint an anonymous bearer token (5/day per IP) |
| GET | `/v1/tokens/me` | Inspect own token + remaining quota |

### Lookups & queries

| Method | Path | Purpose |
|---|---|---|
| GET | `/v1/status` | Latest indexed block + indexed-block count + history depth |
| GET | `/v1/signatures` | Reference of well-known event topic0 hashes |
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
| POST | `/v1/sql` | DataFusion-flavoured `SELECT` against the indexed tables (allowlisted, must filter on `block_num`) |
| GET | `/v1/sql` | Surface description: tables, UDFs, contract |
| GET | `/v1/datasets` | Full programmatic surface — raw + decoded + lookups + aggregates |
| GET | `/v1/stream/blocks` | Server-Sent Events: new blocks as they're indexed |

OpenAPI 3.1 spec at [`/openapi.yaml`](https://camp.cargopete.com/openapi.yaml); browsable reference at [`/docs`](https://camp.cargopete.com/docs).

---

## Dashboards

[`/explore`](https://camp.cargopete.com/explore) — one UI surface for every v1 endpoint:

- [`/explore/sql`](https://camp.cargopete.com/explore/sql) — Dune-style SQL playground with canned examples
- [`/explore/uniswap-v3`](https://camp.cargopete.com/explore/uniswap-v3) — decoded swap/mint/burn per pool
- [`/explore/horizon`](https://camp.cargopete.com/explore/horizon) — Graph Horizon timeline with severity accents
- [`/explore/whales`](https://camp.cargopete.com/explore/whales) — live big-Transfer ticker across the major tokens
- [`/explore/gas`](https://camp.cargopete.com/explore/gas) — base-fee + throughput charts
- [`/explore/token`](https://camp.cargopete.com/explore/token) — bucketed volume + recent transfers for any ERC-20
- [`/explore/address`](https://camp.cargopete.com/explore/address) — wallet profile (tx + transfers + interactions)
- [`/explore/contract`](https://camp.cargopete.com/explore/contract) — log-count time-series for any contract
- [`/explore/lookup`](https://camp.cargopete.com/explore/lookup) — ad-hoc block / tx / events forms
- [`/explore/signatures`](https://camp.cargopete.com/explore/signatures) — well-known topic0 reference

---

## Architecture

```
client
  ↓
camp.cargopete.com                  (edge: TLS, DDoS, CDN cache)
  ↓
Cloudflare Quick Tunnel             (private origin link;
  ↓                                  URL auto-rotates and re-syncs to Vercel env)
nginx :1604                         (shared-secret + Redis rate limit)
  ├─ /         → Flight shim :1606  (JSONL ⇆ Arrow Flight bridge)
  ├─ /srh/     → Redis HTTP shim    (rate-limit state)
  └─ /healthz
  ↓
ampd v0.0.36  (Arbitrum One indexer; Flight on :16021; parquet on local SSD)
```

This repository is the Vercel-hosted public-facing gateway only. The ampd node, Flight shim, Redis shim, nginx, and the Cloudflare tunnel live in a separate ops repo.

### Data freshness

History rebuilds forward from **2026-05-27** (a clean cutover from ampd v0.0.35 → v0.0.36, since the metadata schema isn't downgrade-safe). The window grows by ~24 h every calendar day until it caps at a rolling 30 d. Live depth is on every `/v1/status` response (`history_seconds`, `earliest_indexed_at`).

---

## Run your own camp

camp is one of many possible deployments of the same pattern. If you want to serve other people, or you don't want to share rate limits with strangers, run your own node. The whole thing fits on a small VPS.

**What you'll need:**

- An Arbitrum One RPC endpoint (Alchemy / Infura free tier is enough; a local node is better)
- A server (~4 GB RAM, ~100 GB SSD; the parquet store keeps growing until the compactor catches up)
- Linux + systemd, or Docker / Podman
- Optionally: a domain + Cloudflare for the public-facing edge

**The pieces, in order from the chain outward:**

1. **ampd** — the indexer. From [GitHub Container Registry](https://ghcr.io); see Lodestar's [deep dive](https://www.lodestar-dashboard.com/blog/camp-deep-dive) for current image and config. Register the `arbitrum-one` raw dataset, point at your RPC, let it backfill.
2. **A Flight ⇆ JSONL shim** (~70 lines of Node.js) if you want to use this gateway with ampd v0.0.36+ — the JSONL endpoint was dropped in that release. The shim wraps Arrow Flight in a JSONL response. (Older ampd versions speak JSONL natively and skip this layer.)
3. **nginx** in front of the shim — terminates a shared-secret header and runs IP rate limits via Redis. The gateway expects this layer; see [`.env.example`](.env.example).
4. **This gateway** (the repo you're reading) — deploy to Vercel, or `npm run start` it anywhere with Node.js 22+. Point `AMP_ORIGIN` at nginx.
5. **Cloudflare Tunnel** (optional) — keeps the origin private and gives you DDoS / CDN for free.

**Help & support:** open an issue on [github.com/lodestar-team/camp/issues](https://github.com/lodestar-team/camp/issues). For the indexer side specifically, the [Amp Discord](https://www.lodestar-dashboard.com/blog/camp-deep-dive) is the fastest way to get help.

The gateway is the easy part. The bigger work is indexer ops — backfill, compactor tuning, RPC budget. The deep-dive blog post covers what we learned the hard way.

---

## Fork & customize

camp is built to be forked. Most people who run their own node want it to surface different data — a different chain, different protocols, or a different shape of decoded events.

**Three things you'd typically tweak:**

### 1. Change the indexed chain

camp itself is chain-agnostic. The chain is determined by what your ampd node indexes. Point ampd at a different network's RPC and re-register the dataset (e.g. `_/optimism@1.0.0`), then set `AMP_DATASET` in this gateway to match. Every endpoint that uses `table("logs")` / `table("blocks")` / `table("transactions")` automatically follows.

### 2. Decode a new protocol's events

The decoder pattern lives in [`src/lib/horizon.ts`](src/lib/horizon.ts) and [`src/lib/uniswap-v3.ts`](src/lib/uniswap-v3.ts). Each is just a list of event definitions:

```ts
export const MY_PROTOCOL_EVENTS: MyEvent[] = [
  {
    slug: "transfer-extended",
    name: "TransferExtended",
    decodeSignature:
      "TransferExtended(address indexed from, address indexed to, uint256 value, bytes data)",
    topicSignature: "TransferExtended(address,address,uint256,bytes)",
    fields: [
      { name: "from",  kind: "address", indexed: true  },
      { name: "to",    kind: "address", indexed: true  },
      { name: "value", kind: "uint",    indexed: false },
      { name: "data",  kind: "bytes32", indexed: false },
    ],
  },
  // …
];
```

Drop a new route at `src/app/v1/my-protocol/[event]/route.ts`. The cleanest path is to copy [`src/app/v1/horizon/[event]/route.ts`](src/app/v1/horizon/[event]/route.ts) — it's a ~100-line generic handler that takes any registry. Swap `HORIZON_EVENTS` for your registry and you have a working `/v1/my-protocol/{event}` endpoint with the same caps and caching.

The decoder is powered by ampd's `evm_decode_log` UDF, so any Solidity event signature works — you don't need to write decoding logic yourself.

### 3. Add a new aggregate / view

Time-bucketed aggregates like `/v1/gas/blocks` and `/v1/token/{a}/volume` are all small route files (~80 lines) that translate query params into a single `GROUP BY` SQL statement and hit `ampQuery()`. Copy [`src/app/v1/gas/blocks/route.ts`](src/app/v1/gas/blocks/route.ts) as a template for anything you can express as a single SELECT.

For ad-hoc work you don't want to commit, **`POST /v1/sql`** already accepts arbitrary SELECT statements against `blocks` / `transactions` / `logs` with all UDFs available (`evm_decode_log`, `evm_topic`, `date_trunc`, `arrow_cast`, …). Reach for an endpoint when you want it cached at the edge and discoverable in OpenAPI; reach for raw SQL when you just need an answer.

**Wiring up the rest:**
- Add your endpoint to [`public/openapi.yaml`](public/openapi.yaml) for the `/docs` reference page.
- Add it to the `/v1/datasets` catalog at [`src/app/v1/datasets/route.ts`](src/app/v1/datasets/route.ts) so it shows up in programmatic discovery.
- If it should appear in the `/explore` dashboard nav, add it to the `EXPLORE_ITEMS` list in [`src/app/_components/Nav.tsx`](src/app/_components/Nav.tsx) and drop a `src/app/explore/my-feature/page.tsx`.

That's the full picture — everything in this repo follows the same pattern, so once you've added one new endpoint the rest is repetition.

---

## Local dev

```bash
npm install
cp .env.example .env.local       # then fill in
npm run dev                      # http://localhost:3000
```

Point `AMP_ORIGIN` at `http://localhost:1604` when running against a local ampd. Rate limiting gracefully no-ops without the `UPSTASH_*` vars.

### Env vars

| Var | Purpose |
|-----|---------|
| `AMP_ORIGIN` | Base URL of the JSONL-compatible origin (the Flight shim in prod, ampd JSONL in local dev) |
| `AMP_TOKEN` | Shared secret nginx expects in `X-Amp-Token` |
| `AMP_DATASET` | Fully-qualified dataset@version, e.g. `_/arbitrum_one@2.0.0` |
| `AMP_QUERY_TIMEOUT_MS` | Per-query hard cap, must be < Vercel function timeout (8000 default) |
| `UPSTASH_REDIS_REST_URL` | Redis REST URL (self-hosted shim or Upstash); enables rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Bearer token the Redis REST endpoint expects |

---

## Roadmap

Tracking the bigger plan in [ROADMAP.md](ROADMAP.md). Where we are:

- **Phase 1** ✅ Lookups + cheap aggregates over raw tables
- **Phase A** ✅ Decoded protocol data — Graph Horizon (12 events) + Uniswap V3 (swap/mint/burn) via `evm_decode_log`
- **Phase B** ✅ `/explore` dashboards — 10 server-rendered views, one per endpoint family
- **Phase C** ✅ Raw `POST /v1/sql`, `/v1/datasets` catalog, `/v1/stream/blocks` SSE
- **Phase D** ✅ OpenAPI 3.1 spec + `/docs` reference (Scalar)
- **Phase E** ✅ Flight-native origin — ampd v0.0.36 behind a JSONL ⇆ Flight shim; working compactor
- **Phase F** ✅ Anonymous bearer tokens — opt-in for 10× per-IP limits (300/min · 5,000/hour) with no signup
- **Next** GMX V2 (EventEmitter decoding), CSV / Arrow IPC export, native Amp CDC bridge for live decoded streams, webhooks.

---

## Deploys

The Vercel project isn't Git-connected — deploys happen via `vercel --prod` from a local checkout. Automation in the ops repo redeploys automatically whenever the origin tunnel URL rotates.

For a manual deploy of code changes:

```bash
vercel --prod
```

---

## License

MIT. The underlying Amp engine is BUSL-1.1; this gateway consumes its REST output only.
