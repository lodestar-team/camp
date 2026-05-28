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
    // Single round-trip: hgetall + ttl via a pipeline-ish pair. We
    // deliberately don't call getRemaining() here — the sliding-window
    // counters under each token are a different keyspace, and chaining
    // them adds round-trips that pushed this endpoint past the
    // function timeout in prod.
    const [meta, ttl] = await Promise.all([
      redis.hgetall(`amp-api:token:${token}`) as Promise<{
        created_at?: string;
        tier?: string;
      } | null>,
      redis.ttl(`amp-api:token:${token}`),
    ]);
    if (!meta || Object.keys(meta).length === 0) {
      throw new ApiError(
        "bad_request",
        401,
        "unknown or expired token",
        "mint a new one at POST /v1/tokens",
      );
    }

    return NextResponse.json(
      {
        token_prefix: `${token.slice(0, 10)}…`,
        created_at: meta.created_at ?? null,
        ttl_seconds: ttl >= 0 ? ttl : TOKEN_TTL_SECONDS,
        tier: "token",
        limits: TOKEN_LIMITS.token,
        note: "live remaining-quota numbers aren't exposed yet — they live in a separate sliding-window keyspace.",
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return handle(e);
  }
}
