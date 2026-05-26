import { NextResponse } from "next/server";
import { HORIZON_EVENTS, HORIZON_STAKING_ADDRESS } from "@/lib/horizon";

export const runtime = "nodejs";

// Catalog endpoint: lists every Horizon event we expose, with the URL slug
// and the decoded field shape clients can expect from /v1/horizon/{slug}.
export async function GET() {
  return NextResponse.json(
    {
      contract: HORIZON_STAKING_ADDRESS,
      events: HORIZON_EVENTS.map((e) => ({
        slug: e.slug,
        name: e.name,
        url: `/v1/horizon/${e.slug}`,
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
