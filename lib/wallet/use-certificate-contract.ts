"use client"

import { useCallback } from "react"
import { Contract, formatEther, parseEther, type ContractTransactionReceipt, type ContractTransactionResponse, type Log } from "ethers"
import { CERTIFICATE_ABI } from "@/lib/abi"
import { chainConfig } from "@/lib/config"
import { usdToEthString } from "@/lib/format"
import { useWallet } from "./wallet-provider"
import { useTxTracker, type TxHandle } from "./tx-tracker"
import type { Crop } from "@/lib/types/database"

const wei = (usd: number) => parseEther(usdToEthString(usd))
const eth = (v: bigint) => `${formatEther(v)} ETH`

function eventArg(contract: Contract, receipt: ContractTransactionReceipt | null, name: string, index = 0) {
  for (const log of receipt?.logs ?? []) {
    try {
      const parsed = contract.interface.parseLog(log as Log)
      if (parsed?.name === name) return parsed.args[index]
    } catch {}
  }
  return null
}

export interface ChainResult {
  txHash: string
  blockNumber: number
  /** The open tracker, so the caller can show the database step that follows. */
  tracker: TxHandle
}

/**
 * Typed wrapper over Seed2StoreNFT. Every write is shown live in the transaction tracker
 * (sign → broadcast → mined, with gas and fee). Prices come in USD and convert at the configured rate.
 */
export function useCertificateContract() {
  const { getSigner } = useWallet()
  const tracker = useTxTracker()

  const contract = useCallback(async () => {
    const signer = await getSigner()
    return new Contract(chainConfig.nftContract!, CERTIFICATE_ABI, signer)
  }, [getSigner])

  /** Runs one contract write under the tracker and returns the mined receipt. */
  const run = useCallback(
    async (
      label: string,
      method: string,
      rows: [string, string][],
      send: (c: Contract) => Promise<{ tx: ContractTransactionResponse; valueEth?: string }>,
      describe?: (c: Contract, r: ContractTransactionReceipt) => [string, string][],
    ) => {
      const h = tracker.begin(label, { method, rows })
      try {
        const c = await contract()
        const { tx } = await send(c)
        h.sent(tx.hash)
        const receipt = await tx.wait()
        if (!receipt) throw new Error("The transaction was dropped before it was mined.")
        h.mined(receipt, describe?.(c, receipt))
        return { c, receipt, h }
      } catch (e) {
        h.fail(e)
        throw e
      }
    },
    [contract, tracker],
  )

  const mintCertificate = useCallback(async (crop: Crop) => {
    const lotMinimum = (crop.minimum_price ?? crop.starting_price ?? 0) * crop.quantity
    const lotBuyout = crop.buyout_price ? crop.buyout_price * crop.quantity : 0
    const uri = crop.metadata_uri ?? `s2s:${crop.content_hash}`
    const { c, receipt, h } = await run(
      "Minting the certificate NFT",
      "createCropCertificate",
      [
        ["title", crop.title],
        ["cropType", crop.crop_type],
        ["quantity", `${Math.round(crop.quantity)} ${crop.unit}`],
        ["minimumPrice", eth(wei(lotMinimum))],
        ["buyoutPrice", eth(wei(lotBuyout))],
        ["tokenURI", uri],
      ],
      async (c) => ({
        tx: await c.createCropCertificate(
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
          uri,
        ),
      }),
      (c, r) => [["tokenId (from event)", `#${eventArg(c, r, "CropCertificateCreated") ?? "?"}`]],
    )
    const tokenId = eventArg(c, receipt, "CropCertificateCreated")
    if (tokenId == null) throw new Error("Minted, but the certificate event wasn't found in the receipt.")
    return { tokenId: Number(tokenId), txHash: receipt.hash, blockNumber: receipt.blockNumber, tracker: h }
  }, [run])

  const createAuction = useCallback(async (tokenId: number, p: { startingUsd: number; reserveUsd: number; incrementUsd: number; hours: number }) => {
    const { c, receipt, h } = await run(
      "Opening the on-chain auction",
      "createAuction",
      [
        ["tokenId", `#${tokenId}`],
        ["startingPrice", eth(wei(p.startingUsd))],
        ["reservePrice", eth(wei(p.reserveUsd))],
        ["bidIncrement", eth(wei(p.incrementUsd))],
        ["duration", `${p.hours} h (${Math.round(p.hours * 3600)} s)`],
      ],
      async (c) => ({ tx: await c.createAuction(BigInt(tokenId), wei(p.startingUsd), wei(p.reserveUsd), wei(p.incrementUsd), BigInt(Math.round(p.hours * 3600))) }),
      (c, r) => [["auctionId (from event)", `#${eventArg(c, r, "AuctionCreated") ?? "?"}`]],
    )
    const auctionId = eventArg(c, receipt, "AuctionCreated")
    if (auctionId == null) throw new Error("Auction created, but its ID wasn't found in the receipt.")
    return { auctionId: Number(auctionId), txHash: receipt.hash, blockNumber: receipt.blockNumber, tracker: h }
  }, [run])

  const placeBid = useCallback(async (auctionId: number, usd: number): Promise<ChainResult> => {
    let sent = 0n
    const { receipt, h } = await run(
      "Placing your bid (escrowed by the contract)",
      "placeBid",
      [["auctionId", `#${auctionId}`], ["bid", `₹${usd.toLocaleString("en-IN")} → ${eth(wei(usd))}`]],
      async (c) => {
        // Send at least the contract's own minimum so USD↔ETH rounding can never make a valid bid revert.
        const onchain = await c.getAuction(BigInt(auctionId))
        const min: bigint = onchain.currentBid === 0n ? onchain.startingPrice : onchain.currentBid + onchain.bidIncrement
        sent = wei(usd) > min ? wei(usd) : min
        return { tx: await c.placeBid(BigInt(auctionId), { value: sent }) }
      },
      () => [["msg.value", eth(sent)]],
    )
    return { txHash: receipt.hash, blockNumber: receipt.blockNumber, tracker: h }
  }, [run])

  const finalizeAuction = useCallback(async (auctionId: number): Promise<ChainResult> => {
    const { receipt, h } = await run("Settling the auction", "finalizeAuction", [["auctionId", `#${auctionId}`]], async (c) => ({ tx: await c.finalizeAuction(BigInt(auctionId)) }))
    return { txHash: receipt.hash, blockNumber: receipt.blockNumber, tracker: h }
  }, [run])

  const directPurchase = useCallback(async (tokenId: number): Promise<ChainResult> => {
    let price = 0n
    const { receipt, h } = await run(
      "Buying the lot on-chain",
      "directPurchase",
      [["tokenId", `#${tokenId}`]],
      async (c) => {
        const cert = await c.getCropCertificate(BigInt(tokenId))
        price = cert.buyoutPrice as bigint
        return { tx: await c.directPurchase(BigInt(tokenId), { value: price }) }
      },
      () => [["msg.value", eth(price)], ["NFT", `#${tokenId} → your wallet`]],
    )
    return { txHash: receipt.hash, blockNumber: receipt.blockNumber, tracker: h }
  }, [run])

  return { enabled: chainConfig.enabled, mintCertificate, createAuction, placeBid, finalizeAuction, directPurchase }
}
