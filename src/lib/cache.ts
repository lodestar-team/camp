const FINALITY_DEPTH = 100;

export function cacheHeadersFor(opts: { toBlock: number; tipBlock: number }): HeadersInit {
  const finalized = opts.toBlock + FINALITY_DEPTH < opts.tipBlock;
  if (finalized) {
    return {
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
    };
  }
  return {
    "Cache-Control": "public, max-age=5, s-maxage=5, stale-while-revalidate=30",
  };
}
