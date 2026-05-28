import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import {
  redis,
  checkMintLimit,
  TOKEN_LIMITS,
  TOKEN_TTL_SECONDS,
} from "@/lib/ratelimit";
import { handle, ApiError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 5;

// 20 random bytes → 32 base32 chars (~160 bits). camp_-prefixed so it's
// obvious in logs and easy to grep out of code.
function newToken(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  const bytes = randomBytes(20);
  let out = "";
  let bits = 0;
  let acc = 0;
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += alphabet[(acc >> bits) & 0x1f];
    }
  }
  return `camp_${out}`;
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/v1/tokens",
    method: "POST",
    purpose:
      "Mint an anonymous bearer token for higher per-user rate limits. No signup, no PII.",
    auth: "none — token minting is IP rate-limited instead",
    mint_limit_per_ip: "5 / day",
    on_mint_returns: {
      token: "camp_<32 base32 chars>",
      limits: TOKEN_LIMITS.token,
      ttl_seconds: TOKEN_TTL_SECONDS,
      ttl_human: "30 days (sliding — refreshed on each use)",
    },
    use: {
      header: "Authorization: Bearer camp_<token>",
      alias: "X-Camp-Token: camp_<token>",
    },
    anonymous_limits: TOKEN_LIMITS.anonymous,
    inspect: "GET /v1/tokens/me (requires Authorization)",
  });
}

export async function POST(req: Request) {
  try {
    if (!redis) {
      throw new ApiError(
        "internal",
        503,
        "token minting requires Redis — not configured in this environment",
      );
    }
    const retry = await checkMintLimit(req);
    if (retry !== null) {
      throw new ApiError(
        "rate_limited",
        429,
        "mint limit exceeded for this IP",
        `retry after ${retry}s — anonymous tier (30/min · 500/hour) still works without a token`,
      );
    }

    const token = newToken();
    const created_at = new Date().toISOString();
    await redis.hset(`amp-api:token:${token}`, {
      created_at,
      tier: "token",
    });
    await redis.expire(`amp-api:token:${token}`, TOKEN_TTL_SECONDS);

    return NextResponse.json(
      {
        token,
        created_at,
        limits: TOKEN_LIMITS.token,
        ttl_seconds: TOKEN_TTL_SECONDS,
        use: {
          header: `Authorization: Bearer ${token}`,
          alias: `X-Camp-Token: ${token}`,
        },
        inspect_url: "/v1/tokens/me",
        note: "store this token now — it cannot be retrieved later.",
      },
      {
        status: 201,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (e) {
    return handle(e);
  }
}
