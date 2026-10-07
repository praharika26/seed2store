export interface ChainEvent {
  name: string
  args: Record<string, unknown>
  txHash: string
  blockNumber: number
  logIndex: number
  /** Unix seconds of the containing block. */
  timestamp: number
  valueEth: string | null
  tokenId: number | null
  auctionId: number | null
  /** Joined off-chain: the lot this token certifies. */
  lot?: { id: string; title: string } | null
}

export interface ChainSummary {
  address: string
  chainId: number
  chainName: string
  name: string
  symbol: string
  owner: string
  platformFeeBps: number
  certificatesMinted: number
  auctionsCreated: number
  bidsPlaced: number
  lotsSold: number
  volumeEth: string
  feesHeldEth: string
  latestBlock: number
  deployBlock: number
  totalEvents: number
}

export interface ChainTxDetail {
  hash: string
  status: "success" | "reverted" | "pending"
  blockNumber: number | null
  timestamp: number | null
  confirmations: number
  from: string
  to: string | null
  nonce: number
  valueEth: string
  gasLimit: string
  gasUsed: string | null
  gasPriceGwei: string
  feeEth: string | null
  method: { name: string; signature: string; args: Record<string, unknown> } | null
  events: ChainEvent[]
  input: string
}

export interface TokenDetail {
  tokenId: number
  contract: string
  owner: string
  tokenURI: string
  tokenURIResolved: string
  metadata: unknown
  certificate: Record<string, unknown>
  history: ChainEvent[]
  lot?: { id: string; title: string; crop_type: string; images: string[]; farmer?: { display_name?: string | null; wallet_address: string } } | null
}
