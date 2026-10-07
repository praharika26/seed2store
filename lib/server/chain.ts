import "server-only"
import { Contract, JsonRpcProvider } from "ethers"
import { CERTIFICATE_ABI } from "@/lib/abi"
import { chainConfig } from "@/lib/config"

const RPC_URL = process.env.RPC_URL || chainConfig.rpcUrl

function provider() {
  return new JsonRpcProvider(RPC_URL, chainConfig.id, { staticNetwork: true })
}

async function withTimeout<T>(promise: Promise<T>, ms = 4000): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("RPC timeout")), ms))])
}

export async function chainStatus() {
  if (!chainConfig.enabled) return { configured: false as const }
  try {
    const p = provider()
    const [block, code] = await withTimeout(Promise.all([p.getBlockNumber(), p.getCode(chainConfig.nftContract!)]))
    return { configured: true as const, reachable: true, block, contractDeployed: code !== "0x" }
  } catch (e) {
    return { configured: true as const, reachable: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Reads the on-chain certificate so the verify page can compare it with the off-chain record. */
export async function readCertificate(tokenId: number) {
  if (!chainConfig.enabled) return null
  try {
    const contract = new Contract(chainConfig.nftContract!, CERTIFICATE_ABI, provider())
    const [cert, owner] = await withTimeout(Promise.all([contract.getCropCertificate(tokenId), contract.ownerOf(tokenId)]))
    return {
      tokenId,
      farmer: String(cert.farmer).toLowerCase(),
      owner: String(owner).toLowerCase(),
      title: String(cert.title),
      metadataUri: String(cert.ipfsMetadata),
      isSold: Boolean(cert.isSold),
      createdAt: new Date(Number(cert.createdAt) * 1000).toISOString(),
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
