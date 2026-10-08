// Public runtime configuration shared by client and server.
// The chain is fixed: Seed2StoreNFT, live and verified on Sepolia. No env vars involved.

const SEPOLIA = 11155111

export const chainConfig = {
  id: SEPOLIA,
  hexId: `0x${SEPOLIA.toString(16)}`,
  name: "Sepolia",
  rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
  explorerUrl: "https://sepolia.etherscan.io" as string | undefined,
  isLocal: false,
  isTestnet: true,
  nftContract: "0x19217F965bB80B88DBb8e66dc424414A911D19AB" as `0x${string}` | undefined,
  /** Block the contract was deployed in; event scans start here. */
  deployBlock: 11865088,
  /** True when an NFT contract is configured; on-chain flows are attempted only then. */
  enabled: true,
}

/** Free test-ETH sources shown when a Sepolia wallet is empty. */
export const SEPOLIA_FAUCETS = [
  { name: "Google Cloud faucet", url: "https://cloud.google.com/application/web3/faucet/ethereum/sepolia" },
  { name: "Alchemy faucet", url: "https://www.alchemy.com/faucets/ethereum-sepolia" },
  { name: "Infura faucet", url: "https://www.infura.io/faucet/sepolia" },
]

/** Rupee (INR) value of 1 test-ETH used to convert listing prices to on-chain values. */
export const ETH_USD = 415_000_000

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
