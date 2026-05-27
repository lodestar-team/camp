import { NextResponse } from "next/server";
import { HORIZON_EVENTS, HORIZON_STAKING_ADDRESS } from "@/lib/horizon";
import { UNISWAP_V3_EVENTS } from "@/lib/uniswap-v3";

export const runtime = "nodejs";

// Catalog of every queryable surface camp exposes today. Acts as the
// programmatic discovery endpoint (humans get the same in the landing
// page + roadmap). Future additions: decoded datasets for Aave, GMX,
// Stargate, etc — each becomes another entry below.
export async function GET() {
  const raw = {
    namespace: "_",
    name: "arbitrum_one",
    version: "2.0.0",
    description: "Raw Arbitrum One blocks, transactions, and logs.",
    tables: [
      {
        name: "blocks",
        ref: '"_/arbitrum_one@2.0.0".blocks',
        fields: [
          "block_num",
          "timestamp",
          "hash",
          "parent_hash",
          "miner",
          "gas_limit",
          "gas_used",
          "base_fee_per_gas",
          "extra_data",
          "blob_gas_used",
          "excess_blob_gas",
        ],
      },
      {
        name: "transactions",
        ref: '"_/arbitrum_one@2.0.0".transactions',
        fields: [
          "block_num",
          "tx_index",
          "tx_hash",
          "from",
          "to",
          "value",
          "input",
          "gas_used",
          "gas_price",
          "status",
          "type",
          "nonce",
          "max_fee_per_gas",
          "max_priority_fee_per_gas",
          "access_list",
          "authorization_list",
        ],
      },
      {
        name: "logs",
        ref: '"_/arbitrum_one@2.0.0".logs',
        fields: [
          "block_num",
          "log_index",
          "tx_index",
          "tx_hash",
          "address",
          "topic0",
          "topic1",
          "topic2",
          "topic3",
          "data",
          "timestamp",
        ],
      },
    ],
  };

  const decoded = [
    {
      slug: "horizon",
      name: "Graph Horizon",
      contract: HORIZON_STAKING_ADDRESS,
      endpoint_prefix: "/v1/horizon/",
      catalog_url: "/v1/horizon",
      events: HORIZON_EVENTS.map((e) => ({
        slug: e.slug,
        url: `/v1/horizon/${e.slug}`,
        signature: e.topicSignature,
      })),
    },
    {
      slug: "uniswap-v3",
      name: "Uniswap V3",
      requires: { pool: "pool contract address" },
      endpoint_prefix: "/v1/uniswap-v3/",
      catalog_url: "/v1/uniswap-v3",
      events: UNISWAP_V3_EVENTS.map((e) => ({
        slug: e.slug,
        url: `/v1/uniswap-v3/${e.slug}`,
        signature: e.topicSignature,
      })),
    },
  ];

  const aggregates = [
    { url: "/v1/gas/blocks", description: "gas / base-fee / throughput time-series" },
    { url: "/v1/contract/{addr}/activity", description: "log-count time-series for a contract" },
    { url: "/v1/token/{addr}/volume", description: "token transfer volume per bucket" },
    { url: "/v1/whales/transfers", description: "big-Transfer feed for any token" },
    { url: "/v1/address/{addr}/interactions", description: "distinct contracts an address called" },
  ];

  const lookups = [
    { url: "/v1/status", description: "engine sync state" },
    { url: "/v1/signatures", description: "well-known event topic0s" },
    { url: "/v1/block/{n}", description: "full block + every tx + every log" },
    { url: "/v1/tx/{hash}", description: "tx + receipt + emitted logs" },
    { url: "/v1/address/{addr}/tx", description: "address tx history" },
    { url: "/v1/address/{addr}/transfers", description: "token movements in/out of address" },
    { url: "/v1/transfers", description: "decoded ERC-20/721 Transfer events for a token" },
    { url: "/v1/events", description: "generic log filter by address + topic" },
  ];

  return NextResponse.json(
    {
      chain: "arbitrum-one",
      raw,
      decoded_protocols: decoded,
      lookups,
      aggregates,
      sql_endpoint: {
        url: "/v1/sql",
        method: "POST",
        contract: "SELECT-only, must reference block_num, LIMIT capped at 1000, 8s timeout",
      },
      streams: [
        { url: "/v1/stream/blocks", description: "live block headers as they're indexed (SSE)" },
      ],
      openapi: {
        url: "/openapi.yaml",
        version: "3.1.0",
        docs: "/docs",
      },
    },
    {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
    },
  );
}
