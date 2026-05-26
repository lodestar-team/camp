import { z } from "zod";

const schema = z.object({
  AMP_ORIGIN: z.string().url(),
  AMP_TOKEN: z.string().min(16),
  AMP_DATASET: z.string().default("_/arbitrum_one@1.0.0"),
  AMP_QUERY_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
});

export const env = schema.parse({
  AMP_ORIGIN: process.env.AMP_ORIGIN,
  AMP_TOKEN: process.env.AMP_TOKEN,
  AMP_DATASET: process.env.AMP_DATASET,
  AMP_QUERY_TIMEOUT_MS: process.env.AMP_QUERY_TIMEOUT_MS,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export const ratelimitEnabled =
  !!env.UPSTASH_REDIS_REST_URL && !!env.UPSTASH_REDIS_REST_TOKEN;
