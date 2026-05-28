import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public read-only API: every /v1/* response is safe to expose to any
// browser origin. Credentials are not used (auth is IP rate limiting at
// the edge), so the wildcard origin is fine. `Vary: Origin` keeps the
// edge cache honest if we ever switch to an allowlist.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

export function proxy(request: NextRequest) {
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }
  const response = NextResponse.next();
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    response.headers.set(k, v);
  }
  return response;
}

export const config = {
  matcher: "/v1/:path*",
};
