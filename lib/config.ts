// Public runtime configuration shared by client and server.
// Everything here is read from NEXT_PUBLIC_* env vars so it is inlined into the client bundle.

const env = (value: string | undefined) => (value && value.trim() ? value.trim() : undefined)

const nftContract =
  env(process.env.NEXT_PUBLIC_NFT_CONTRACT) ?? env(process.env.NEXT_PUBLIC_AGRITRUST_NFT_CONTRACT)

const chainId = Number(env(process.env.NEXT_PUBLIC_CHAIN_ID) ?? 31337)

const LOCAL_CHAIN_IDS = new Set([31337, 1337])
const SEPOLIA = 11155111

export const chainConfig = {
  id: chainId,
  hexId: `0x${chainId.toString(16)}`,
  name: env(process.env.NEXT_PUBLIC_CHAIN_NAME) ?? (chainId === 1337 ? "Ganache" : chainId === 31337 ? "Hardhat Local" : chainId === SEPOLIA ? "Sepolia" : `Chain ${chainId}`),
  rpcUrl: env(process.env.NEXT_PUBLIC_RPC_URL) ?? (chainId === 1337 ? "http://127.0.0.1:7545" : chainId === SEPOLIA ? "https://ethereum-sepolia-rpc.publicnode.com" : "http://127.0.0.1:8545"),
  explorerUrl: env(process.env.NEXT_PUBLIC_EXPLORER_URL) ?? (chainId === SEPOLIA ? "https://sepolia.etherscan.io" : undefined),
  isLocal: LOCAL_CHAIN_IDS.has(chainId),
  isTestnet: chainId === SEPOLIA,
  nftContract: nftContract as `0x${string}` | undefined,
  /** Block the contract was deployed in; event scans start here. */
  deployBlock: Number(env(process.env.NEXT_PUBLIC_DEPLOY_BLOCK) ?? 0),
  /** True when an NFT contract is configured; on-chain flows are attempted only then. */
  enabled: Boolean(nftContract),
}

/** Free test-ETH sources shown when a Sepolia wallet is empty. */
export const SEPOLIA_FAUCETS = [
  { name: "Google Cloud faucet", url: "https://cloud.google.com/application/web3/faucet/ethereum/sepolia" },
  { name: "Alchemy faucet", url: "https://www.alchemy.com/faucets/ethereum-sepolia" },
  { name: "Infura faucet", url: "https://www.infura.io/faucet/sepolia" },
]

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

export function explorerToken(tokenId?: number | null) {
  if (tokenId == null || !chainConfig.explorerUrl || !chainConfig.nftContract) return undefined
  return `${chainConfig.explorerUrl}/nft/${chainConfig.nftContract}/${tokenId}`
}
