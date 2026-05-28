import { NextResponse } from "next/server";
import {
  redis,
  clientToken,
  TOKEN_LIMITS,
  TOKEN_TTL_SECONDS,
} from "@/lib/ratelimit";
import { handle, ApiError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 5;

type TokenMeta = { created_at?: string; tier?: string };

export async function GET(req: Request) {
  try {
    const token = clientToken(req);
    if (!token) {
      throw new ApiError(
        "bad_request",
        401,
        "missing bearer token",
        "send Authorization: Bearer camp_<token>",
      );
    }
    if (!redis) {
      throw new ApiError("internal", 503, "tokens require Redis");
    }

    const key = `amp-api:token:${token}`;
    const raw = await redis.get<string | TokenMeta>(key);
    if (raw == null) {
      throw new ApiError(
        "bad_request",
        401,
        "unknown or expired token",
        "mint a new one at POST /v1/tokens",
      );
    }
    // @upstash/redis auto-deserialises JSON strings on the way back, so
    // raw is already an object. But it can also come back as a string if
    // the shim doesn't set the right content-type; handle both.
    const meta: TokenMeta =
      typeof raw === "string" ? (JSON.parse(raw) as TokenMeta) : raw;
    const ttl = await redis.ttl(key);

    return NextResponse.json(
      {
        token_prefix: `${token.slice(0, 10)}…`,
        created_at: meta.created_at ?? null,
        ttl_seconds: ttl >= 0 ? ttl : TOKEN_TTL_SECONDS,
        tier: "token",
        limits: TOKEN_LIMITS.token,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return handle(e);
  }
}
