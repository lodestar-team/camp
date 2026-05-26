import { z } from "zod";
import { isAddress } from "viem";

const hex = (bytes: number) =>
  z
    .string()
    .regex(new RegExp(`^0x[0-9a-fA-F]{${bytes * 2}}$`), `expected 0x-prefixed ${bytes}-byte hex`)
    .transform((s) => s.toLowerCase());

export const addressParam = z.string().refine(isAddress, "invalid EVM address").transform((s) => s.toLowerCase());

export const topicParam = hex(32);

const MAX_BLOCK_SPAN = 100_000;

export const rangeParams = z
  .object({
    from_block: z.coerce.number().int().nonnegative(),
    to_block: z.coerce.number().int().nonnegative(),
  })
  .refine((v) => v.to_block >= v.from_block, "to_block must be >= from_block")
  .refine(
    (v) => v.to_block - v.from_block <= MAX_BLOCK_SPAN,
    `block range cannot exceed ${MAX_BLOCK_SPAN} blocks`,
  );

export const limitParam = z.coerce.number().int().min(1).max(1000).default(100);

export const blockNumParam = z.coerce.number().int().nonnegative();
export const txHashParam = hex(32);

// Time-bucket granularity for aggregate endpoints. Maps to date_trunc args.
export const bucketParam = z
  .enum(["minute", "hour", "day"])
  .default("hour");

// Pad a 20-byte address to a 32-byte topic value (12 leading zero bytes).
export function addressToTopic(addr: string): string {
  const lower = addr.toLowerCase().replace(/^0x/, "");
  return `0x${"0".repeat(24)}${lower}`;
}
