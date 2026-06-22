#!/usr/bin/env node
/**
 * camp-mcp — a Model Context Protocol server over the camp REST API.
 *
 * Lets any MCP client (Claude Desktop/Code, Cursor, etc.) query Arbitrum One
 * on-chain data — blocks, transactions, decoded transfers/events, Uniswap v3,
 * whale flows, and raw SQL — with NO API key and NO signup.
 *
 * It's a thin, stateless wrapper over https://engine.camp. Point your agent at
 * it and ask questions in natural language.
 *
 * Run:   npx camp-mcp
 * Env:   CAMP_BASE_URL  (default https://engine.camp)
 *        CAMP_TOKEN     (optional anonymous bearer for higher rate limits)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = (process.env.CAMP_BASE_URL || "https://engine.camp").replace(/\/$/, "");
const TOKEN = process.env.CAMP_TOKEN || null;
const UA = "camp-mcp/0.1.0";

function authHeaders(extra = {}) {
  const h = { "User-Agent": UA, ...extra };
  if (TOKEN) h["Authorization"] = `Bearer ${TOKEN}`;
  return h;
}

/** GET a camp REST path (with query string already built). Returns parsed JSON or throws. */
async function campGet(path) {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders() });
  const text = await res.text();
  if (!res.ok) throw new Error(`camp ${path} -> HTTP ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

/** POST a read-only SQL string to /v1/sql. Returns { count, rows, elapsed_ms }. */
async function campSql(query) {
  const res = await fetch(`${BASE}/v1/sql`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "text/plain" }),
    body: query,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`camp /v1/sql -> HTTP ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text); // { count, rows: [...], elapsed_ms }
}

/** Build a query string from an object, dropping null/undefined values. */
function qs(params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Wrap any handler so thrown errors come back as a clean isError tool result. */
function ok(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}
function fail(e) {
  return { content: [{ type: "text", text: `Error: ${e?.message ?? String(e)}` }], isError: true };
}

const server = new McpServer({ name: "camp", version: "0.1.0" });

const rangeShape = {
  from_block: z.number().int().nonnegative().optional()
    .describe("Start block (inclusive). Omit for a recent window up to the chain tip."),
  to_block: z.number().int().nonnegative().optional()
    .describe("End block (inclusive). Omit to use the chain tip."),
  limit: z.number().int().min(1).max(1000).optional().describe("Max rows (default 100, max 1000)."),
};

server.registerTool(
  "status",
  {
    title: "Chain status",
    description: "Indexer health for camp: latest indexed block, earliest block, indexed-block count, and how much history (the rolling window) is currently available on Arbitrum One. Call this first to learn the queryable block range.",
    inputSchema: {},
  },
  async () => {
    try { return ok(await campGet("/v1/status")); } catch (e) { return fail(e); }
  },
);

server.registerTool(
  "sql",
  {
    title: "Run read-only SQL",
    description:
      "Run a read-only DataFusion SELECT against the indexed Arbitrum tables (blocks, transactions, logs). The most powerful tool — Dune-style analytics, live and free. The query MUST filter on block_num (e.g. WHERE block_num BETWEEN x AND y) and stay within ~100k blocks. Tip: call `status` first for the current block range, and `sql_help` for the table schema, UDFs, and example queries.",
    inputSchema: {
      query: z.string().describe(
        "A single SELECT statement. Table names are fully qualified, e.g. \"_/arbitrum_one@4.0.1\".logs. Binary columns (address, topic0..3, tx_hash) compare via X'..' literals and read out via encode(arrow_cast(col,'Binary'),'hex'). Must include a block_num filter.",
      ),
    },
  },
  async ({ query }) => {
    try { return ok(await campSql(query)); } catch (e) { return fail(e); }
  },
);

server.registerTool(
  "sql_help",
  {
    title: "SQL surface help",
    description: "Describe the SQL surface: available tables, columns, UDFs, the block_num filter contract, and worked example queries. Read this before writing a `sql` query.",
    inputSchema: {},
  },
  async () => {
    try { return ok(await campGet("/v1/sql")); } catch (e) { return fail(e); }
  },
);

server.registerTool(
  "transfers",
  {
    title: "ERC-20/721 transfers",
    description: "Decoded ERC-20/721 Transfer events (token, from, to, value as an exact decimal string). With no token, returns the latest transfers chain-wide; pass `token` to scope to one ERC-20. `value` is base units (apply the token's decimals yourself).",
    inputSchema: {
      token: z.string().optional().describe("ERC-20/721 contract address (0x…). Omit for chain-wide."),
      ...rangeShape,
    },
  },
  async ({ token, from_block, to_block, limit }) => {
    try { return ok(await campGet(`/v1/transfers${qs({ token, from_block, to_block, limit })}`)); }
    catch (e) { return fail(e); }
  },
);

server.registerTool(
  "whale_transfers",
  {
    title: "Whale transfers",
    description: "Large Transfer events. With no args, returns $1M+ native-USDC transfers near the chain tip. Pass `token` for another ERC-20 and `min_value` (base units, no decimals) as the threshold.",
    inputSchema: {
      token: z.string().optional().describe("ERC-20 contract address (0x…). Default: native USDC."),
      min_value: z.string().optional().describe("Minimum transfer value in base units, integer string (e.g. '1000000000000' = $1M USDC)."),
      from_block: z.number().int().nonnegative().optional(),
      to_block: z.number().int().nonnegative().optional(),
      limit: z.number().int().min(1).max(1000).optional(),
    },
  },
  async ({ token, min_value, from_block, to_block, limit }) => {
    try { return ok(await campGet(`/v1/whales/transfers${qs({ token, min_value, from_block, to_block, limit })}`)); }
    catch (e) { return fail(e); }
  },
);

server.registerTool(
  "token_volume",
  {
    title: "Token transfer volume",
    description: "Bucketed transfer count and summed volume for an ERC-20 over a recent window. Useful for activity/volume time-series.",
    inputSchema: {
      token: z.string().describe("ERC-20 contract address (0x…)."),
      bucket: z.enum(["minute", "hour", "day"]).optional().describe("Time bucket (default hour)."),
      from_block: z.number().int().nonnegative().optional(),
      to_block: z.number().int().nonnegative().optional(),
    },
  },
  async ({ token, bucket, from_block, to_block }) => {
    try { return ok(await campGet(`/v1/token/${token}/volume${qs({ bucket, from_block, to_block })}`)); }
    catch (e) { return fail(e); }
  },
);

server.registerTool(
  "address_activity",
  {
    title: "Address activity",
    description: "Activity for a wallet/contract address: its transactions (kind='tx'), token movements (kind='transfers'), or the distinct contracts it called (kind='interactions').",
    inputSchema: {
      address: z.string().describe("Address to inspect (0x…)."),
      kind: z.enum(["tx", "transfers", "interactions"]).optional().describe("What to fetch (default 'tx')."),
      from_block: z.number().int().nonnegative().optional(),
      to_block: z.number().int().nonnegative().optional(),
      limit: z.number().int().min(1).max(1000).optional(),
    },
  },
  async ({ address, kind = "tx", from_block, to_block, limit }) => {
    try {
      const path = kind === "interactions" ? "interactions" : kind === "transfers" ? "transfers" : "tx";
      return ok(await campGet(`/v1/address/${address}/${path}${qs({ from_block, to_block, limit })}`));
    } catch (e) { return fail(e); }
  },
);

server.registerTool(
  "events",
  {
    title: "Raw logs / events",
    description: "Generic event-log filter. With no args, returns the latest logs chain-wide (each row carries its emitting contract address and topic0..3 + data, all hex). Filter by `address` and/or `topic0` (the event signature hash).",
    inputSchema: {
      address: z.string().optional().describe("Emitting contract address (0x…). Omit for chain-wide."),
      topic0: z.string().optional().describe("Event signature hash (0x…, 32 bytes)."),
      ...rangeShape,
    },
  },
  async ({ address, topic0, from_block, to_block, limit }) => {
    try { return ok(await campGet(`/v1/events${qs({ address, topic0, from_block, to_block, limit })}`)); }
    catch (e) { return fail(e); }
  },
);

server.registerTool(
  "uniswap_v3",
  {
    title: "Uniswap v3 events",
    description: "Decoded Uniswap v3 events per pool. event = swap | mint | burn (default swap). With no pool, defaults to the USDC/WETH 0.05% pool.",
    inputSchema: {
      event: z.enum(["swap", "mint", "burn"]).optional().describe("Event type (default 'swap')."),
      pool: z.string().optional().describe("V3 pool contract address (0x…). Default: USDC/WETH 0.05%."),
      from_block: z.number().int().nonnegative().optional(),
      to_block: z.number().int().nonnegative().optional(),
      limit: z.number().int().min(1).max(1000).optional(),
    },
  },
  async ({ event = "swap", pool, from_block, to_block, limit }) => {
    try { return ok(await campGet(`/v1/uniswap-v3/${event}${qs({ pool, from_block, to_block, limit })}`)); }
    catch (e) { return fail(e); }
  },
);

server.registerTool(
  "block",
  {
    title: "Get block",
    description: "Full block by number: header plus every transaction and every log.",
    inputSchema: { number: z.number().int().nonnegative().describe("Block number.") },
  },
  async ({ number }) => {
    try { return ok(await campGet(`/v1/block/${number}`)); } catch (e) { return fail(e); }
  },
);

server.registerTool(
  "tx",
  {
    title: "Get transaction",
    description: "A transaction and its logs by hash.",
    inputSchema: { hash: z.string().describe("Transaction hash (0x…, 32 bytes).") },
  },
  async ({ hash }) => {
    try { return ok(await campGet(`/v1/tx/${hash}`)); } catch (e) { return fail(e); }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
// stderr is safe for logs; stdout is the MCP transport channel.
console.error(`camp-mcp connected → ${BASE}${TOKEN ? " (authed)" : ""}`);
