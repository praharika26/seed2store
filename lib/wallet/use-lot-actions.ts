"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"
import { api, errorMessage } from "@/lib/api"
import { chainConfig } from "@/lib/config"
import { formatUSD } from "@/lib/format"
import { useCertificateContract } from "./use-certificate-contract"
import type { TxHandle } from "./tx-tracker"
import type { Auction, Crop } from "@/lib/types/database"

type Busy = null | "mint" | "bid" | "buy" | "auction" | "finalize" | "offer"

/** Saves the off-chain record for a mined transaction and reflects it as the tracker's final step. */
async function record<T>(tracker: TxHandle, save: () => Promise<T>) {
  tracker.saving()
  try {
    const result = await save()
    tracker.done()
    return result
  } catch (e) {
    tracker.fail(e)
    throw e
  }
}

/**
 * Every lot action in one place. When the lot is certified on-chain (and a contract is configured) the
 * wallet transaction happens first — shown live in the transaction tracker — and the server then records
 * the resulting hash in MongoDB; otherwise the action is off-chain.
 */
export function useLotActions() {
  const contract = useCertificateContract()
  const [busy, setBusy] = useState<Busy>(null)

  const run = useCallback(async <T,>(kind: Exclude<Busy, null>, pending: string | null, fn: () => Promise<T>, success?: (r: T) => string): Promise<T | null> => {
    setBusy(kind)
    // On-chain actions show the tracker dialog instead of a loading toast.
    const id = pending ? toast.loading(pending) : undefined
    try {
      const result = await fn()
      if (success) toast.success(success(result), { id })
      else if (id) toast.dismiss(id)
      return result
    } catch (e) {
      if (id) toast.error(errorMessage(e), { id })
      return null
    } finally {
      setBusy(null)
    }
  }, [])

  const onchain = (crop: Pick<Crop, "nft_minted" | "nft_token_id">) => chainConfig.enabled && crop.nft_minted && crop.nft_token_id != null

  const mint = useCallback((crop: Crop) =>
    run("mint", null, async () => {
      const r = await contract.mintCertificate(crop)
      return record(r.tracker, () => api<Crop>(`/api/crops/${crop.id}/mint`, { method: "POST", json: { token_id: r.tokenId, transaction_hash: r.txHash } }))
    }, (c) => `Certificate minted as NFT #${c.nft_token_id}`), [run, contract])

  const placeBid = useCallback((auction: Auction, amount: number) => {
    const chain = Boolean(auction.blockchain_id && chainConfig.enabled)
    return run("bid", chain ? null : "Placing your bid…", async () => {
      if (!chain) return api(`/api/auctions/${auction.id}/bids`, { method: "POST", json: { amount } })
      const r = await contract.placeBid(auction.blockchain_id!, amount)
      return record(r.tracker, () => api(`/api/auctions/${auction.id}/bids`, { method: "POST", json: { amount, transaction_hash: r.txHash } }))
    }, () => `You're the top bidder at ${formatUSD(amount)}`)
  }, [run, contract])

  const buyNow = useCallback((crop: Crop, delivery_address?: string) =>
    run("buy", onchain(crop) ? null : "Placing your order…", async () => {
      if (!onchain(crop)) return api(`/api/crops/${crop.id}/buy`, { method: "POST", json: { delivery_address } })
      const r = await contract.directPurchase(crop.nft_token_id!)
      return record(r.tracker, () => api(`/api/crops/${crop.id}/buy`, { method: "POST", json: { transaction_hash: r.txHash, delivery_address } }))
    }, () => (onchain(crop) ? "Purchased: the certificate NFT is now in your wallet" : "Order placed. Settle payment with the grower to proceed")), [run, contract])

  const startAuction = useCallback((crop: Crop, p: { startingUsd: number; reserveUsd?: number; incrementUsd: number; hours: number }) =>
    run("auction", onchain(crop) ? null : "Opening your auction…", async () => {
      const body = { crop_id: crop.id, starting_price: p.startingUsd, reserve_price: p.reserveUsd, bid_increment: p.incrementUsd, duration_hours: p.hours }
      if (!onchain(crop)) return api<Auction>("/api/auctions", { method: "POST", json: body })
      const r = await contract.createAuction(crop.nft_token_id!, { startingUsd: p.startingUsd, reserveUsd: p.reserveUsd ?? p.startingUsd, incrementUsd: p.incrementUsd, hours: p.hours })
      return record(r.tracker, () => api<Auction>("/api/auctions", { method: "POST", json: { ...body, blockchain_id: r.auctionId, transaction_hash: r.txHash } }))
    }, () => "Your auction is live"), [run, contract])

  const finalize = useCallback((auction: Auction) =>
    run("finalize", null, async () => {
      const r = await contract.finalizeAuction(auction.blockchain_id!)
      return record(r.tracker, () => api(`/api/auctions/${auction.id}/finalize`, { method: "POST", json: { transaction_hash: r.txHash } }))
    }, () => "Auction settled on-chain"), [run, contract])

  return { busy, mint, placeBid, buyNow, startAuction, finalize, run, chainEnabled: chainConfig.enabled }
}
