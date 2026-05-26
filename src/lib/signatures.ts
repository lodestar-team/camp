export const EVENT_SIGNATURES: ReadonlyArray<{
  topic0: string;
  name: string;
  signature: string;
  indexed: readonly string[];
}> = [
  {
    topic0: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    name: "Transfer",
    signature: "Transfer(address,address,uint256)",
    indexed: ["from", "to"],
  },
  {
    topic0: "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925",
    name: "Approval",
    signature: "Approval(address,address,uint256)",
    indexed: ["owner", "spender"],
  },
  {
    topic0: "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62",
    name: "TransferSingle",
    signature: "TransferSingle(address,address,address,uint256,uint256)",
    indexed: ["operator", "from", "to"],
  },
  {
    topic0: "0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb",
    name: "TransferBatch",
    signature: "TransferBatch(address,address,address,uint256[],uint256[])",
    indexed: ["operator", "from", "to"],
  },
  {
    topic0: "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67",
    name: "UniswapV3Swap",
    signature: "Swap(address,address,int256,int256,uint160,uint128,int24)",
    indexed: ["sender", "recipient"],
  },
  {
    topic0: "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822",
    name: "UniswapV2Swap",
    signature: "Swap(address,uint256,uint256,uint256,uint256,address)",
    indexed: ["sender", "to"],
  },
];

export const TRANSFER_TOPIC0 = EVENT_SIGNATURES[0]!.topic0;
