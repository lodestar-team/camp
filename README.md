# camp

Community [**Amp**](https://github.com/edgeandnode/amp) node — a free, tip-fresh REST gateway over Arbitrum One. Vercel is the public edge; the origin is one consumer laptop on residential internet. No SLA.

Live at **https://amp-public-api.vercel.app** (project will be renamed to `camp.vercel.app` once the alias is migrated).

See [src/app/page.tsx](src/app/page.tsx) for the public-facing landing page (endpoint catalog, rate limits, disclaimer).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/v1/status` | Latest indexed block + count |
| GET | `/v1/signatures` | Reference of well-known event topic0s |
| GET | `/v1/transfers?token=…&from_block=…&to_block=…&limit=…` | ERC-20 / 721 Transfer events, decoded |
| GET | `/v1/events?address=…&topic0=…&topic1=…&from_block=…&to_block=…&limit=…` | Generic log filter |

Server-side caps: block span ≤ 100,000 · rows ≤ 1,000 · query timeout 8 s. Rate limit: 30/min · 500/hour per IP.

## Architecture

```
client
  ↓
https://amp-public-api.vercel.app   (Vercel: TLS, DDoS, CDN cache)
  ↓
Cloudflare Quick Tunnel             (auto-rotates URL on cloudflared restart;
  ↓                                   sync script in the ampd repo handles it)
nginx :1604 (ThinkPad)
  ├─ /         → ampd JSONL :1603   (X-Amp-Token gate)
  ├─ /srh/     → SRH :8079 → redis  (Bearer-token gate, rate-limit state)
  └─ /healthz
  ↓
ampd  (Arbitrum One indexer, parquet on local SSD)
```

The ampd node, Redis, nginx, and the cloudflared tunnel live in a separate private repo (`cargopete/amping`). This project is just the public-facing Vercel gateway.

## Local dev

```bash
npm install
cp .env.example .env.local       # then fill in
npm run dev                      # http://localhost:3000
```

For local dev, point `AMP_ORIGIN` at `http://localhost:1604` if you're on the same machine as an ampd node, and skip the `UPSTASH_*` vars — rate limiting gracefully no-ops without them.

## Env vars

| Var | Purpose |
|-----|---------|
| `AMP_ORIGIN` | Base URL of the ampd JSONL endpoint (via tunnel in prod) |
| `AMP_TOKEN` | Shared secret nginx expects in `X-Amp-Token` |
| `AMP_DATASET` | Fully-qualified dataset@version, e.g. `_/arbitrum_one@2.0.0` |
| `AMP_QUERY_TIMEOUT_MS` | Per-query hard cap, must be < Vercel function timeout (8000 default) |
| `UPSTASH_REDIS_REST_URL` | Self-hosted SRH URL via tunnel (`$AMP_ORIGIN/srh`); enables rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Bearer token SRH validates |

## Deploys

The Vercel project is **not** Git-connected — deploys happen via `vercel --prod` from a local checkout. Automation in the ampd repo redeploys automatically whenever the cloudflared tunnel URL rotates.

For a manual deploy of code changes:

```bash
vercel --prod
```

## License

MIT. The Amp engine itself is BUSL-1.1; this gateway only consumes its REST output.
