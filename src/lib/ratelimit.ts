import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env, ratelimitEnabled } from "./env";
import { ApiError } from "./errors";

const redis = ratelimitEnabled
  ? new Redis({
      url: env.UPSTASH_REDIS_REST_URL!,
      token: env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

const perMinute = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "1 m"),
      prefix: "amp-api:rl:min",
      analytics: false,
    })
  : null;

const perHour = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(500, "1 h"),
      prefix: "amp-api:rl:hour",
      analytics: false,
    })
  : null;

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}

export async function checkRateLimit(req: Request): Promise<void> {
  if (!perMinute || !perHour) return;
  const ip = clientIp(req);
  const [m, h] = await Promise.all([perMinute.limit(ip), perHour.limit(ip)]);
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
