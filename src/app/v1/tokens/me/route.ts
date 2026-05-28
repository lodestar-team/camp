import { NextResponse } from "next/server";
import {
  redis,
  clientToken,
  inspectQuota,
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
    const meta = (await redis.hgetall(`amp-api:token:${token}`)) as
      | { created_at?: string; tier?: string }
      | null;
    if (!meta || Object.keys(meta).length === 0) {
      throw new ApiError(
        "bad_request",
        401,
        "unknown or expired token",
        "mint a new one at POST /v1/tokens",
      );
    }
    const quota = await inspectQuota({ token });
    const ttl = await redis.ttl(`amp-api:token:${token}`);

    return NextResponse.json(
      {
        token_prefix: `${token.slice(0, 10)}…`,
        created_at: meta.created_at ?? null,
        ttl_seconds: ttl >= 0 ? ttl : TOKEN_TTL_SECONDS,
        tier: quota?.tier ?? "token",
        limits: quota?.limits ?? null,
        remaining: quota?.remaining ?? null,
        reset: quota?.reset ?? null,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return handle(e);
  }
}
