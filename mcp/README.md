# camp-mcp

**Query Arbitrum One on-chain data from any AI agent — no API key, no signup.**

An [MCP](https://modelcontextprotocol.io) server over [camp](https://engine.camp), the free
Dune-class data API for Arbitrum One. Point Claude, Cursor, or any MCP client at it and ask:

> *"What were the biggest USDC transfers on Arbitrum in the last hour?"*
> *"Show me the latest Uniswap v3 swaps in the USDC/WETH pool."*
> *"Write SQL to count transactions per block over the last 5,000 blocks and run it."*

It's a thin, stateless wrapper — your agent calls camp's public REST API. Nothing to host.

## Tools

| Tool | What it does |
|---|---|
| `status` | Chain tip, indexed range, history depth (call first) |
| `sql` | Run a read-only DataFusion SELECT (the power tool — Dune-style) |
| `sql_help` | Tables, columns, UDFs, and example queries for `sql` |
| `transfers` | Decoded ERC-20/721 Transfers (chain-wide or per token) |
| `whale_transfers` | Large transfers ($1M+ USDC by default) |
| `token_volume` | Bucketed transfer count + volume for an ERC-20 |
| `address_activity` | A wallet/contract's txs, transfers, or interactions |
| `events` | Raw log filter (chain-wide or by address/topic) |
| `uniswap_v3` | Decoded v3 swap/mint/burn (defaults to USDC/WETH 0.05%) |
| `block` / `tx` | Look up a block or transaction |

Every tool works with zero/minimal args — bare calls return live data near the chain tip.

## Setup

Requires Node ≥ 18. No install needed beyond `npx`.

**Claude Code**
```bash
claude mcp add camp -- npx -y camp-mcp
```

**Claude Desktop** — add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "camp": { "command": "npx", "args": ["-y", "camp-mcp"] }
  }
}
```

**Cursor** — add to `~/.cursor/mcp.json` (same shape as above).

Restart the client; "camp" and its tools will appear.

## Configuration (optional)

| Env var | Default | Purpose |
|---|---|---|
| `CAMP_BASE_URL` | `https://engine.camp` | Point at your own camp node |
| `CAMP_TOKEN` | — | Anonymous bearer for higher rate limits (mint via `POST /v1/tokens`) |

```json
{
  "mcpServers": {
    "camp": {
      "command": "npx",
      "args": ["-y", "camp-mcp"],
      "env": { "CAMP_TOKEN": "camp_xxx" }
    }
  }
}
```

## Notes

- **Rolling window.** camp keeps a recent window of Arbitrum history (currently ~15 days,
  growing toward ~30). It's built for *fresh* data, not deep history. `status` reports the
  exact queryable block range.
- **SQL must filter on `block_num`** and stay within ~100k blocks per query. Ask the agent to
  call `status` then `sql_help` before composing a query.
- Anonymous limits apply (30 req/min · 500/hour per IP); set `CAMP_TOKEN` to raise them.

MIT licensed. Part of [camp](https://github.com/lodestar-team/camp).
