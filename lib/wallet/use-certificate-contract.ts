"use client"

import { useCallback } from "react"
import { Contract, parseEther, type ContractTransactionReceipt, type Log } from "ethers"
import { CERTIFICATE_ABI } from "@/lib/abi"
import { chainConfig } from "@/lib/config"
import { usdToEthString } from "@/lib/format"
import { useWallet } from "./wallet-provider"
import type { Crop } from "@/lib/types/database"

const wei = (usd: number) => parseEther(usdToEthString(usd))

function eventArg(contract: Contract, receipt: ContractTransactionReceipt | null, name: string, index = 0) {
  for (const log of receipt?.logs ?? []) {
    try {
      const parsed = contract.interface.parseLog(log as Log)
      if (parsed?.name === name) return parsed.args[index]
    } catch {}
  }
  return null
}

/** Thin, typed wrapper over Seed2StoreNFT. Prices are passed in USD and converted at the configured rate. */
export function useCertificateContract() {
  const { getSigner } = useWallet()

  const contract = useCallback(async () => {
    const signer = await getSigner()
    return new Contract(chainConfig.nftContract!, CERTIFICATE_ABI, signer)
  }, [getSigner])

  const mintCertificate = useCallback(async (crop: Crop) => {
    const c = await contract()
    const lotMinimum = (crop.minimum_price ?? crop.starting_price ?? 0) * crop.quantity
    const lotBuyout = crop.buyout_price ? crop.buyout_price * crop.quantity : 0
    const tx = await c.createCropCertificate(
      crop.title,
      crop.description.slice(0, 280),
      crop.crop_type,
      crop.variety ?? "",
      BigInt(Math.max(1, Math.round(crop.quantity))),
      crop.unit,
      crop.location ?? "",
      crop.organic_certified,
      crop.quality_grade ?? "",
      BigInt(crop.harvest_date ? Math.floor(new Date(crop.harvest_date).getTime() / 1000) : 0),
      wei(lotMinimum),
      wei(lotBuyout),
      crop.metadata_uri ?? `s2s:${crop.content_hash}`,
    )
    const receipt = await tx.wait()
    const tokenId = eventArg(c, receipt, "CropCertificateCreated")
    if (tokenId == null) throw new Error("Minted, but the certificate event wasn't found in the receipt.")
    return { tokenId: Number(tokenId), txHash: receipt!.hash }
  }, [contract])

  const createAuction = useCallback(async (tokenId: number, p: { startingUsd: number; reserveUsd: number; incrementUsd: number; hours: number }) => {
    const c = await contract()
    const tx = await c.createAuction(BigInt(tokenId), wei(p.startingUsd), wei(p.reserveUsd), wei(p.incrementUsd), BigInt(Math.round(p.hours * 3600)))
    const receipt = await tx.wait()
    const auctionId = eventArg(c, receipt, "AuctionCreated")
    if (auctionId == null) throw new Error("Auction created, but its ID wasn't found in the receipt.")
    return { auctionId: Number(auctionId), txHash: receipt!.hash }
  }, [contract])

  const placeBid = useCallback(async (auctionId: number, usd: number) => {
    const c = await contract()
    // Send at least the contract's own minimum so USD↔ETH rounding can never make a valid bid revert.
    const onchain = await c.getAuction(BigInt(auctionId))
    const min: bigint = onchain.currentBid === 0n ? onchain.startingPrice : onchain.currentBid + onchain.bidIncrement
    const value = wei(usd) > min ? wei(usd) : min
    const tx = await c.placeBid(BigInt(auctionId), { value })
    const receipt = await tx.wait()
    return { txHash: receipt!.hash }
  }, [contract])

  const finalizeAuction = useCallback(async (auctionId: number) => {
    const c = await contract()
    const tx = await c.finalizeAuction(BigInt(auctionId))
    const receipt = await tx.wait()
    return { txHash: receipt!.hash }
  }, [contract])

  const directPurchase = useCallback(async (tokenId: number) => {
    const c = await contract()
    const cert = await c.getCropCertificate(BigInt(tokenId))
    const tx = await c.directPurchase(BigInt(tokenId), { value: cert.buyoutPrice as bigint })
    const receipt = await tx.wait()
    return { txHash: receipt!.hash }
  }, [contract])

  return { enabled: chainConfig.enabled, mintCertificate, createAuction, placeBid, finalizeAuction, directPurchase }
}
