import { NextResponse } from "next/server";
import { EVENT_SIGNATURES } from "@/lib/signatures";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    { signatures: EVENT_SIGNATURES },
    {
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
    },
  );
}
