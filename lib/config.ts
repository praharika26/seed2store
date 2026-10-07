// Public runtime configuration shared by client and server.
// Everything here is read from NEXT_PUBLIC_* env vars so it is inlined into the client bundle.

const env = (value: string | undefined) => (value && value.trim() ? value.trim() : undefined)

const nftContract =
  env(process.env.NEXT_PUBLIC_NFT_CONTRACT) ?? env(process.env.NEXT_PUBLIC_AGRITRUST_NFT_CONTRACT)

const chainId = Number(env(process.env.NEXT_PUBLIC_CHAIN_ID) ?? 31337)

const LOCAL_CHAIN_IDS = new Set([31337, 1337])

export const chainConfig = {
  id: chainId,
  hexId: `0x${chainId.toString(16)}`,
  name: env(process.env.NEXT_PUBLIC_CHAIN_NAME) ?? (chainId === 1337 ? "Ganache" : chainId === 31337 ? "Hardhat Local" : chainId === 11155111 ? "Sepolia" : `Chain ${chainId}`),
  rpcUrl: env(process.env.NEXT_PUBLIC_RPC_URL) ?? (chainId === 1337 ? "http://127.0.0.1:7545" : "http://127.0.0.1:8545"),
  explorerUrl: env(process.env.NEXT_PUBLIC_EXPLORER_URL) ?? (chainId === 11155111 ? "https://sepolia.etherscan.io" : undefined),
  isLocal: LOCAL_CHAIN_IDS.has(chainId),
  nftContract: nftContract as `0x${string}` | undefined,
  /** True when an NFT contract is configured; on-chain flows are attempted only then. */
  enabled: Boolean(nftContract),
}

/** USD value of 1 ETH used to convert listing prices to on-chain values. */
export const ETH_USD = Number(env(process.env.NEXT_PUBLIC_ETH_USD) ?? 2500)

export function explorerTx(hash?: string | null) {
  if (!hash || !chainConfig.explorerUrl) return undefined
  return `${chainConfig.explorerUrl}/tx/${hash}`
}

export function explorerAddress(address?: string | null) {
  if (!address || !chainConfig.explorerUrl) return undefined
  return `${chainConfig.explorerUrl}/address/${address}`
}
