import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env, ratelimitEnabled } from "./env";
import { ApiError } from "./errors";

// Anonymous (no token): 30 / min · 500 / hour, keyed by IP.
// Authenticated (valid token): 300 / min · 5000 / hour, keyed by token.
// Token minting: 5 / day per IP.
const ANON_PER_MIN = 30;
const ANON_PER_HOUR = 500;
const TOKEN_PER_MIN = 300;
const TOKEN_PER_HOUR = 5000;
const MINT_PER_DAY = 5;

// 30d sliding TTL — refreshed on each successful auth check.
export const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export const TOKEN_LIMITS = {
  anonymous: { per_minute: ANON_PER_MIN, per_hour: ANON_PER_HOUR },
  token: { per_minute: TOKEN_PER_MIN, per_hour: TOKEN_PER_HOUR },
} as const;

export const redis = ratelimitEnabled
  ? new Redis({
      url: env.UPSTASH_REDIS_REST_URL!,
      token: env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

const perMinuteIp = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(ANON_PER_MIN, "1 m"),
      prefix: "amp-api:rl:min",
      analytics: false,
    })
  : null;

const perHourIp = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(ANON_PER_HOUR, "1 h"),
      prefix: "amp-api:rl:hour",
      analytics: false,
    })
  : null;

const perMinuteToken = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(TOKEN_PER_MIN, "1 m"),
      prefix: "amp-api:rl:tok:min",
      analytics: false,
    })
  : null;

const perHourToken = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(TOKEN_PER_HOUR, "1 h"),
      prefix: "amp-api:rl:tok:hour",
      analytics: false,
    })
  : null;

const perDayMint = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(MINT_PER_DAY, "1 d"),
      prefix: "amp-api:rl:mint",
      analytics: false,
    })
  : null;

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}

// Read the caller's bearer token from either Authorization: Bearer ... or
// X-Camp-Token: ... (curl-friendly alias). Returns null if absent.
export function clientToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth) {
    const m = /^Bearer\s+(\S+)$/i.exec(auth);
    if (m) return m[1]!;
  }
  const xct = req.headers.get("x-camp-token");
  if (xct) return xct.trim();
  return null;
}

// Look up a token in Redis. Returns true if it's valid (exists) and
// refreshes the TTL as a side-effect. Cheap: 1 GET + 1 EXPIRE per request.
export async function isTokenValid(token: string): Promise<boolean> {
  if (!redis) return false;
  const key = `amp-api:token:${token}`;
  const exists = await redis.exists(key);
  if (exists !== 1) return false;
  // Sliding window — touching the token extends its life.
  await redis.expire(key, TOKEN_TTL_SECONDS);
  return true;
}

export async function checkRateLimit(req: Request): Promise<void> {
  if (!perMinuteIp || !perHourIp || !perMinuteToken || !perHourToken) return;
  const token = clientToken(req);
  let useToken = false;
  if (token !== null) {
    // If a token is provided, it must be valid — silent downgrade to the
    // anonymous tier would mask expired tokens until clients notice the
    // mysterious 429s. Better to fail fast with 401.
    const valid = await isTokenValid(token);
    if (!valid) {
      throw new ApiError(
        "bad_request",
        401,
        "unknown or expired token",
        "mint a new one at POST /v1/tokens, or drop the Authorization header to use the anonymous tier",
      );
    }
    useToken = true;
  }
  const key = useToken ? token! : clientIp(req);
  const [m, h] = useToken
    ? await Promise.all([perMinuteToken.limit(key), perHourToken.limit(key)])
    : await Promise.all([perMinuteIp.limit(key), perHourIp.limit(key)]);
  const limited = !m.success ? m : !h.success ? h : null;
  if (limited) {
    throw new ApiError(
      "rate_limited",
      429,
      "rate limit exceeded",
      `retry after ${Math.ceil((limited.reset - Date.now()) / 1000)}s`,
    );
  }
}

// Rate-limit the mint endpoint by IP (separate bucket, generous-but-finite).
// Returns retry-after seconds if limited, null if allowed.
export async function checkMintLimit(req: Request): Promise<number | null> {
  if (!perDayMint) return null;
  const r = await perDayMint.limit(clientIp(req));
  return r.success ? null : Math.ceil((r.reset - Date.now()) / 1000);
}

