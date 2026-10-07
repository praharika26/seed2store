import "server-only"
import { Contract, Interface, JsonRpcProvider, ZeroAddress, formatEther, type Log } from "ethers"
import { CERTIFICATE_ABI } from "@/lib/abi"
import { chainConfig } from "@/lib/config"
import type { ChainEvent, ChainSummary, ChainTxDetail, TokenDetail } from "@/lib/types/chain"

const RPC_URL = process.env.RPC_URL || chainConfig.rpcUrl
const iface = new Interface(CERTIFICATE_ABI)
const LOG_CHUNK = Number(process.env.RPC_LOG_CHUNK || 9_000) // public RPCs cap eth_getLogs ranges

let providerSingleton: JsonRpcProvider | null = null
function provider() {
  providerSingleton ??= new JsonRpcProvider(RPC_URL, chainConfig.id, { staticNetwork: true })
  return providerSingleton
}
const contract = () => new Contract(chainConfig.nftContract!, CERTIFICATE_ABI, provider())

async function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("RPC timeout")), ms))])
}

/** Recursively converts ethers Results/bigints into plain JSON values. */
function plain(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString()
  // ethers Result: named fields aren't own-enumerable, so convert through toObject() first.
  if (value && typeof (value as { toObject?: unknown }).toObject === "function") {
    try {
      const obj = (value as { toObject: () => Record<string, unknown> }).toObject()
      if (Object.keys(obj).some((k) => !/^\d+$/.test(k))) return plain(obj)
    } catch {}
  }
  if (Array.isArray(value)) return value.map(plain)
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) if (!/^\d+$/.test(k)) out[k] = plain(v)
    return out
  }
  return value
}

function namedArgs(fragmentInputs: readonly { name: string }[], args: ArrayLike<unknown>) {
  const out: Record<string, unknown> = {}
  fragmentInputs.forEach((input, i) => (out[input.name || `arg${i}`] = plain(args[i])))
  return out
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Events (the ledger)
// ---------------------------------------------------------------------------

const blockTimes = new Map<number, number>()
let eventCache: { at: number; events: ChainEvent[] } | null = null

async function blockTime(n: number) {
  if (!blockTimes.has(n)) {
    const b = await provider().getBlock(n)
    blockTimes.set(n, b ? b.timestamp : 0)
  }
  return blockTimes.get(n)!
}

function decodeLog(log: Log): ChainEvent | null {
  try {
    const parsed = iface.parseLog(log)
    if (!parsed) return null
    const args = namedArgs(parsed.fragment.inputs, parsed.args)
    const amount = (args.amount ?? args.finalPrice ?? args.startingPrice) as string | undefined
    return {
      name: parsed.name,
      args,
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
      logIndex: log.index,
      timestamp: 0,
      valueEth: amount !== undefined ? formatEther(amount) : null,
      tokenId: args.tokenId !== undefined ? Number(args.tokenId) : null,
      auctionId: args.auctionId !== undefined ? Number(args.auctionId) : null,
    }
  } catch {
    return null
  }
}

/** Every event the contract has ever emitted, newest first. Cached briefly; chunked for public RPC limits. */
export async function listChainEvents(): Promise<ChainEvent[]> {
  if (!chainConfig.enabled) return []
  if (eventCache && Date.now() - eventCache.at < 8_000) return eventCache.events
  const p = provider()
  const latest = await withTimeout(p.getBlockNumber())
  const logs: Log[] = []
  for (let from = chainConfig.deployBlock; from <= latest; from += LOG_CHUNK) {
    const to = Math.min(latest, from + LOG_CHUNK - 1)
    logs.push(...(await withTimeout(p.getLogs({ address: chainConfig.nftContract, fromBlock: from, toBlock: to }), 20_000)))
  }
  const events = logs.map(decodeLog).filter(Boolean) as ChainEvent[]

  // Auction events carry auctionId only; resolve their tokenId from AuctionCreated.
  const auctionToken = new Map<number, number>()
  for (const e of events) if (e.name === "AuctionCreated" && e.auctionId != null && e.tokenId != null) auctionToken.set(e.auctionId, e.tokenId)
  for (const e of events) if (e.tokenId == null && e.auctionId != null) e.tokenId = auctionToken.get(e.auctionId) ?? null

  const blocks = [...new Set(events.map((e) => e.blockNumber))]
  await Promise.all(blocks.map((b) => blockTime(b)))
  for (const e of events) e.timestamp = blockTimes.get(e.blockNumber) ?? 0

  events.sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex)
  eventCache = { at: Date.now(), events }
  return events
}

export function invalidateChainCache() {
  eventCache = null
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export async function chainSummary(): Promise<ChainSummary | null> {
  if (!chainConfig.enabled) return null
  const c = contract()
  const p = provider()
  const [name, symbol, owner, fee, minted, auctions, balance, block, events] = await withTimeout(
    Promise.all([
      c.name(), c.symbol(), c.owner(), c.platformFee(), c.getCurrentTokenId(), c.getCurrentAuctionId(),
      p.getBalance(chainConfig.nftContract!), p.getBlockNumber(), listChainEvents(),
    ]),
    25_000,
  )
  const sold = events.filter((e) => e.name === "CropSold")
  return {
    address: chainConfig.nftContract!,
    chainId: chainConfig.id,
    chainName: chainConfig.name,
    name,
    symbol,
    owner,
    platformFeeBps: Number(fee),
    certificatesMinted: Number(minted),
    auctionsCreated: Number(auctions),
    bidsPlaced: events.filter((e) => e.name === "BidPlaced").length,
    lotsSold: sold.length,
    volumeEth: formatEther(sold.reduce((sum, e) => sum + BigInt(String(e.args.amount ?? 0)), 0n)),
    feesHeldEth: formatEther(balance),
    latestBlock: block,
    deployBlock: chainConfig.deployBlock,
    totalEvents: events.length,
  }
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export async function getChainTx(hash: string): Promise<ChainTxDetail | null> {
  if (!chainConfig.enabled) return null
  const p = provider()
  const [tx, receipt] = await withTimeout(Promise.all([p.getTransaction(hash), p.getTransactionReceipt(hash)]))
  if (!tx) return null
  let method: ChainTxDetail["method"] = null
  try {
    const parsed = iface.parseTransaction({ data: tx.data, value: tx.value })
    if (parsed) method = { name: parsed.name, signature: parsed.signature, args: namedArgs(parsed.fragment.inputs, parsed.args) }
  } catch {}
  const block = receipt ? await p.getBlock(receipt.blockNumber) : null
  const gasPrice = receipt?.gasPrice ?? tx.gasPrice ?? 0n
  const events = (receipt?.logs ?? [])
    .filter((l) => l.address.toLowerCase() === chainConfig.nftContract!.toLowerCase())
    .map((l) => decodeLog(l as unknown as Log))
    .filter(Boolean) as ChainEvent[]
  for (const e of events) e.timestamp = block?.timestamp ?? 0
  return {
    hash: tx.hash,
    status: receipt ? (receipt.status === 1 ? "success" : "reverted") : "pending",
    blockNumber: receipt?.blockNumber ?? null,
    timestamp: block?.timestamp ?? null,
    confirmations: receipt ? await receipt.confirmations() : 0,
    from: tx.from,
    to: tx.to,
    nonce: tx.nonce,
    valueEth: formatEther(tx.value),
    gasLimit: tx.gasLimit.toString(),
    gasUsed: receipt?.gasUsed.toString() ?? null,
    gasPriceGwei: (Number(gasPrice) / 1e9).toFixed(3),
    feeEth: receipt ? formatEther(receipt.gasUsed * gasPrice) : null,
    method,
    events,
    input: tx.data,
  }
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

export function resolveUri(uri: string) {
  if (uri.startsWith("ipfs://")) return `${(process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud").replace(/\/$/, "")}/ipfs/${uri.slice(7)}`
  return uri
}

// IPFS content is immutable by CID, so a fetched metadata document never needs refetching.
const metadataCache = new Map<string, unknown>()
async function fetchMetadata(uri: string) {
  if (metadataCache.has(uri)) return metadataCache.get(uri)
  try {
    const res = await withTimeout(fetch(resolveUri(uri), { headers: { accept: "application/json" } }), 8000)
    if (!res.ok) return null
    const json = await res.json()
    if (uri.startsWith("ipfs://")) metadataCache.set(uri, json)
    return json
  } catch {
    return null
  }
}

export async function getTokenDetail(tokenId: number): Promise<TokenDetail | null> {
  if (!chainConfig.enabled) return null
  const c = contract()
  let cert, owner: string, uri: string
  try {
    ;[cert, owner, uri] = await withTimeout(Promise.all([c.getCropCertificate(tokenId), c.ownerOf(tokenId), c.tokenURI(tokenId)]))
  } catch {
    return null
  }
  const metadata = await fetchMetadata(uri)
  const history = (await listChainEvents()).filter((e) => e.tokenId === tokenId)
  return {
    tokenId,
    contract: chainConfig.nftContract!,
    owner: String(owner),
    tokenURI: uri,
    tokenURIResolved: resolveUri(uri),
    metadata,
    certificate: plain(cert) as Record<string, unknown>,
    history,
  }
}

/** Token IDs currently held by an address (scans ownerOf; fine for a demo-scale collection). */
export async function tokensOwnedBy(address: string) {
  if (!chainConfig.enabled) return []
  const c = contract()
  const total = Number(await withTimeout(c.getCurrentTokenId()))
  const ids = Array.from({ length: total }, (_, i) => i + 1)
  const owners = await withTimeout(Promise.all(ids.map((id) => c.ownerOf(id).catch(() => ZeroAddress))), 20_000)
  return ids.filter((_, i) => String(owners[i]).toLowerCase() === address.toLowerCase())
}

/** Reads the on-chain certificate so the verify page can compare it with the off-chain record. */
export async function readCertificate(tokenId: number) {
  if (!chainConfig.enabled) return null
  try {
    const [cert, owner] = await withTimeout(Promise.all([contract().getCropCertificate(tokenId), contract().ownerOf(tokenId)]))
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

/** Native balance (and NFT count when a contract is set) for the wallet chip. */
export async function walletBalance(address: string) {
  const p = provider()
  const [wei, nfts] = await withTimeout(
    Promise.all([p.getBalance(address), chainConfig.enabled ? contract().balanceOf(address).catch(() => 0n) : Promise.resolve(0n)]),
  )
  return { eth: formatEther(wei), nfts: Number(nfts), chainId: chainConfig.id, chainName: chainConfig.name }
}
