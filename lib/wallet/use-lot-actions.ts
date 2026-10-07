"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"
import { api, errorMessage } from "@/lib/api"
import { chainConfig } from "@/lib/config"
import { formatUSD } from "@/lib/format"
import { useCertificateContract } from "./use-certificate-contract"
import type { Auction, Crop } from "@/lib/types/database"

type Busy = null | "mint" | "bid" | "buy" | "auction" | "finalize" | "offer"

/**
 * Every lot action in one place. When the lot is certified on-chain (and a contract is configured) the
 * wallet transaction happens first and the server records the resulting hash; otherwise it's off-chain.
 */
export function useLotActions() {
  const contract = useCertificateContract()
  const [busy, setBusy] = useState<Busy>(null)

  const run = useCallback(async <T,>(kind: Exclude<Busy, null>, pending: string, fn: () => Promise<T>, success?: (r: T) => string): Promise<T | null> => {
    setBusy(kind)
    const id = toast.loading(pending)
    try {
      const result = await fn()
      if (success) toast.success(success(result), { id })
      else toast.dismiss(id)
      return result
    } catch (e) {
      toast.error(errorMessage(e), { id })
      return null
    } finally {
      setBusy(null)
    }
  }, [])

  const onchain = (crop: Pick<Crop, "nft_minted" | "nft_token_id">) => chainConfig.enabled && crop.nft_minted && crop.nft_token_id != null

  const mint = useCallback((crop: Crop) =>
    run("mint", "Confirm the certificate mint in your wallet…", async () => {
      const { tokenId, txHash } = await contract.mintCertificate(crop)
      return api<Crop>(`/api/crops/${crop.id}/mint`, { method: "POST", json: { token_id: tokenId, transaction_hash: txHash } })
    }, (c) => `Certificate minted as token #${c.nft_token_id}`), [run, contract])

  const placeBid = useCallback((auction: Auction, amount: number) =>
    run("bid", auction.blockchain_id && chainConfig.enabled ? "Confirm your bid in your wallet — funds are escrowed by the contract…" : "Placing your bid…", async () => {
      let transaction_hash: string | null = null
      if (auction.blockchain_id && chainConfig.enabled) transaction_hash = (await contract.placeBid(auction.blockchain_id, amount)).txHash
      return api(`/api/auctions/${auction.id}/bids`, { method: "POST", json: { amount, transaction_hash } })
    }, () => `You're the top bidder at ${formatUSD(amount)}`), [run, contract])

  const buyNow = useCallback((crop: Crop, delivery_address?: string) =>
    run("buy", onchain(crop) ? "Confirm the purchase in your wallet…" : "Placing your order…", async () => {
      let transaction_hash: string | null = null
      if (onchain(crop)) transaction_hash = (await contract.directPurchase(crop.nft_token_id!)).txHash
      return api(`/api/crops/${crop.id}/buy`, { method: "POST", json: { transaction_hash, delivery_address } })
    }, () => (onchain(crop) ? "Purchased: the certificate is now in your wallet" : "Order placed. Settle payment with the grower to proceed")), [run, contract])

  const startAuction = useCallback((crop: Crop, p: { startingUsd: number; reserveUsd?: number; incrementUsd: number; hours: number }) =>
    run("auction", onchain(crop) ? "Confirm the auction in your wallet…" : "Opening your auction…", async () => {
      let chain: { auctionId: number; txHash: string } | null = null
      if (onchain(crop)) chain = await contract.createAuction(crop.nft_token_id!, { startingUsd: p.startingUsd, reserveUsd: p.reserveUsd ?? p.startingUsd, incrementUsd: p.incrementUsd, hours: p.hours })
      return api<Auction>("/api/auctions", {
        method: "POST",
        json: { crop_id: crop.id, starting_price: p.startingUsd, reserve_price: p.reserveUsd, bid_increment: p.incrementUsd, duration_hours: p.hours, blockchain_id: chain?.auctionId ?? null, transaction_hash: chain?.txHash ?? null },
      })
    }, () => "Your auction is live"), [run, contract])

  const finalize = useCallback((auction: Auction) =>
    run("finalize", "Confirm settlement in your wallet…", async () => {
      const { txHash } = await contract.finalizeAuction(auction.blockchain_id!)
      return api(`/api/auctions/${auction.id}/finalize`, { method: "POST", json: { transaction_hash: txHash } })
    }, () => "Auction settled on-chain"), [run, contract])

  return { busy, mint, placeBid, buyNow, startAuction, finalize, run, chainEnabled: chainConfig.enabled }
}
