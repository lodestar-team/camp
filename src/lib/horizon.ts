// Graph Horizon staking events on Arbitrum One.
//
// We expose each event under /v1/horizon/{slug}. Internally we resolve the
// slug to a signature, derive topic0 via evm_topic() inside the SQL, and
// decode every matching log row with evm_decode_log.

export const HORIZON_STAKING_ADDRESS =
  "0x00669a4cf01450b64e8a2a20e9b1fcb71e61ef03";

// One entry per event the contract emits, in the order the ABI defines.
// `decodeSignature` is the Solidity event signature exactly as
// evm_decode_log wants it (with `indexed` keywords on indexed args).
// `topicSignature` is the canonical form (no `indexed`, no names, no
// spaces) that evm_topic expects — keeps regex-substitution out of the
// hot path.
// `fields` lists the decoded fields and their type, so we know which
// ones need decimal-string serialization vs hex-prefixed address.
export type FieldKind = "address" | "uint" | "bytes32";
export type HorizonEvent = {
  slug: string;
  name: string;
  decodeSignature: string;
  topicSignature: string;
  fields: { name: string; kind: FieldKind; indexed: boolean }[];
};

export const HORIZON_EVENTS: HorizonEvent[] = [
  {
    slug: "horizon-stake-deposited",
    name: "HorizonStakeDeposited",
    decodeSignature:
      "HorizonStakeDeposited(address indexed serviceProvider, uint256 tokens)",
    topicSignature: "HorizonStakeDeposited(address,uint256)",
    fields: [
      { name: "serviceProvider", kind: "address", indexed: true },
      { name: "tokens", kind: "uint", indexed: false },
    ],
  },
  {
    slug: "horizon-stake-locked",
    name: "HorizonStakeLocked",
    decodeSignature:
      "HorizonStakeLocked(address indexed serviceProvider, uint256 tokens, uint256 until)",
    topicSignature: "HorizonStakeLocked(address,uint256,uint256)",
    fields: [
      { name: "serviceProvider", kind: "address", indexed: true },
      { name: "tokens", kind: "uint", indexed: false },
      { name: "until", kind: "uint", indexed: false },
    ],
  },
  {
    slug: "horizon-stake-withdrawn",
    name: "HorizonStakeWithdrawn",
    decodeSignature:
      "HorizonStakeWithdrawn(address indexed serviceProvider, uint256 tokens)",
    topicSignature: "HorizonStakeWithdrawn(address,uint256)",
    fields: [
      { name: "serviceProvider", kind: "address", indexed: true },
      { name: "tokens", kind: "uint", indexed: false },
    ],
  },
  {
    slug: "provision-created",
    name: "ProvisionCreated",
    decodeSignature:
      "ProvisionCreated(address indexed serviceProvider, address indexed verifier, uint256 tokens, uint32 maxVerifierCut, uint64 thawingPeriod)",
    topicSignature: "ProvisionCreated(address,address,uint256,uint32,uint64)",
    fields: [
      { name: "serviceProvider", kind: "address", indexed: true },
      { name: "verifier", kind: "address", indexed: true },
      { name: "tokens", kind: "uint", indexed: false },
      { name: "maxVerifierCut", kind: "uint", indexed: false },
      { name: "thawingPeriod", kind: "uint", indexed: false },
    ],
  },
  {
    slug: "provision-increased",
    name: "ProvisionIncreased",
    decodeSignature:
      "ProvisionIncreased(address indexed serviceProvider, address indexed verifier, uint256 tokens)",
    topicSignature: "ProvisionIncreased(address,address,uint256)",
    fields: [
      { name: "serviceProvider", kind: "address", indexed: true },
      { name: "verifier", kind: "address", indexed: true },
      { name: "tokens", kind: "uint", indexed: false },
    ],
  },
  {
    slug: "provision-thawed",
    name: "ProvisionThawed",
    decodeSignature:
      "ProvisionThawed(address indexed serviceProvider, address indexed verifier, uint256 tokens)",
    topicSignature: "ProvisionThawed(address,address,uint256)",
    fields: [
      { name: "serviceProvider", kind: "address", indexed: true },
      { name: "verifier", kind: "address", indexed: true },
      { name: "tokens", kind: "uint", indexed: false },
    ],
  },
  {
    slug: "tokens-deprovisioned",
    name: "TokensDeprovisioned",
    decodeSignature:
      "TokensDeprovisioned(address indexed serviceProvider, address indexed verifier, uint256 tokens)",
    topicSignature: "TokensDeprovisioned(address,address,uint256)",
    fields: [
      { name: "serviceProvider", kind: "address", indexed: true },
      { name: "verifier", kind: "address", indexed: true },
      { name: "tokens", kind: "uint", indexed: false },
    ],
  },
  {
    slug: "provision-slashed",
    name: "ProvisionSlashed",
    decodeSignature:
      "ProvisionSlashed(address indexed serviceProvider, address indexed verifier, uint256 tokens)",
    topicSignature: "ProvisionSlashed(address,address,uint256)",
    fields: [
      { name: "serviceProvider", kind: "address", indexed: true },
      { name: "verifier", kind: "address", indexed: true },
      { name: "tokens", kind: "uint", indexed: false },
    ],
  },
  {
    slug: "tokens-delegated",
    name: "TokensDelegated",
    decodeSignature:
      "TokensDelegated(address indexed serviceProvider, address indexed verifier, address indexed delegator, uint256 tokens, uint256 shares)",
    topicSignature: "TokensDelegated(address,address,address,uint256,uint256)",
    fields: [
      { name: "serviceProvider", kind: "address", indexed: true },
      { name: "verifier", kind: "address", indexed: true },
      { name: "delegator", kind: "address", indexed: true },
      { name: "tokens", kind: "uint", indexed: false },
      { name: "shares", kind: "uint", indexed: false },
    ],
  },
  {
    slug: "tokens-undelegated",
    name: "TokensUndelegated",
    decodeSignature:
      "TokensUndelegated(address indexed serviceProvider, address indexed verifier, address indexed delegator, uint256 tokens, uint256 shares)",
    topicSignature: "TokensUndelegated(address,address,address,uint256,uint256)",
    fields: [
      { name: "serviceProvider", kind: "address", indexed: true },
      { name: "verifier", kind: "address", indexed: true },
      { name: "delegator", kind: "address", indexed: true },
      { name: "tokens", kind: "uint", indexed: false },
      { name: "shares", kind: "uint", indexed: false },
    ],
  },
  {
    slug: "delegated-tokens-withdrawn",
    name: "DelegatedTokensWithdrawn",
    decodeSignature:
      "DelegatedTokensWithdrawn(address indexed serviceProvider, address indexed verifier, address indexed delegator, uint256 tokens)",
    topicSignature: "DelegatedTokensWithdrawn(address,address,address,uint256)",
    fields: [
      { name: "serviceProvider", kind: "address", indexed: true },
      { name: "verifier", kind: "address", indexed: true },
      { name: "delegator", kind: "address", indexed: true },
      { name: "tokens", kind: "uint", indexed: false },
    ],
  },
  {
    slug: "delegation-slashed",
    name: "DelegationSlashed",
    decodeSignature:
      "DelegationSlashed(address indexed serviceProvider, address indexed verifier, uint256 tokens)",
    topicSignature: "DelegationSlashed(address,address,uint256)",
    fields: [
      { name: "serviceProvider", kind: "address", indexed: true },
      { name: "verifier", kind: "address", indexed: true },
      { name: "tokens", kind: "uint", indexed: false },
    ],
  },
  // DelegationFeeCutSet is uint8 indexed — needs separate handling; skip
  // for the v0 cut to keep all events on the same projection shape.
];

export const HORIZON_EVENT_BY_SLUG = new Map(
  HORIZON_EVENTS.map((e) => [e.slug, e]),
);
