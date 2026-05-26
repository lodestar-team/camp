import { NextResponse } from "next/server";
import { UNISWAP_V3_EVENTS } from "@/lib/uniswap-v3";

export const runtime = "nodejs";

// Catalog endpoint — describes the events camp exposes for Uniswap V3 pools.
export async function GET() {
  return NextResponse.json(
    {
      protocol: "uniswap-v3",
      chain: "arbitrum-one",
      requires: { pool: "Uniswap V3 pool contract address (0x…)" },
      events: UNISWAP_V3_EVENTS.map((e) => ({
        slug: e.slug,
        name: e.name,
        url: `/v1/uniswap-v3/${e.slug}`,
        signature: e.topicSignature,
        fields: e.fields.map((f) => ({
          name: f.name,
          kind: f.kind,
          indexed: f.indexed,
          filterable: f.indexed && f.kind === "address",
        })),
      })),
    },
    {
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
    },
  );
}
