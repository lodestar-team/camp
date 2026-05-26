// Uniswap V3 pool events on Arbitrum One.
//
// Unlike Horizon (one contract), every V3 pool is its own contract — so the
// caller passes a `pool=0x…` query param and we filter by that address.
// A pool can be looked up via Uniswap's subgraph or via the factory's
// `getPool(tokenA, tokenB, fee)` call (which is exposed by our /v1/sql
// once Phase C ships).
//
// Same event-registry pattern as src/lib/horizon.ts: `decodeSignature` is
// what evm_decode_log expects (with `indexed` + names); `topicSignature` is
// the canonical form fed to evm_topic.

export type FieldKind = "address" | "uint" | "int" | "bytes32";
export type UniswapV3Event = {
  slug: string;
  name: string;
  decodeSignature: string;
  topicSignature: string;
  fields: { name: string; kind: FieldKind; indexed: boolean }[];
};

export const UNISWAP_V3_EVENTS: UniswapV3Event[] = [
  {
    slug: "swap",
    name: "Swap",
    decodeSignature:
      "Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)",
    topicSignature:
      "Swap(address,address,int256,int256,uint160,uint128,int24)",
    fields: [
      { name: "sender", kind: "address", indexed: true },
      { name: "recipient", kind: "address", indexed: true },
      { name: "amount0", kind: "int", indexed: false },
      { name: "amount1", kind: "int", indexed: false },
      { name: "sqrtPriceX96", kind: "uint", indexed: false },
      { name: "liquidity", kind: "uint", indexed: false },
      { name: "tick", kind: "int", indexed: false },
    ],
  },
  {
    slug: "mint",
    name: "Mint",
    decodeSignature:
      "Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)",
    topicSignature:
      "Mint(address,address,int24,int24,uint128,uint256,uint256)",
    fields: [
      { name: "sender", kind: "address", indexed: false },
      { name: "owner", kind: "address", indexed: true },
      { name: "tickLower", kind: "int", indexed: true },
      { name: "tickUpper", kind: "int", indexed: true },
      { name: "amount", kind: "uint", indexed: false },
      { name: "amount0", kind: "uint", indexed: false },
      { name: "amount1", kind: "uint", indexed: false },
    ],
  },
  {
    slug: "burn",
    name: "Burn",
    decodeSignature:
      "Burn(address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)",
    topicSignature: "Burn(address,int24,int24,uint128,uint256,uint256)",
    fields: [
      { name: "owner", kind: "address", indexed: true },
      { name: "tickLower", kind: "int", indexed: true },
      { name: "tickUpper", kind: "int", indexed: true },
      { name: "amount", kind: "uint", indexed: false },
      { name: "amount0", kind: "uint", indexed: false },
      { name: "amount1", kind: "uint", indexed: false },
    ],
  },
];

export const UNISWAP_V3_EVENT_BY_SLUG = new Map(
  UNISWAP_V3_EVENTS.map((e) => [e.slug, e]),
);
