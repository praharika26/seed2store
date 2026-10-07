"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowLeft, BadgeCheck, CalendarDays, Droplets, Leaf, MapPin, Package, ShieldCheck, Warehouse } from "lucide-react"
import { CropMedia, PhotoCredit } from "@/components/crop-art"
import { cropPhoto } from "@/lib/crop-photos"
import { Certificate } from "@/components/certificate"
import { Address, Avatar, CropStatusPill, Pill, TxHash } from "@/components/bits"
import { ActionPanel } from "@/components/lot/action-panel"
import { BidHistory, LotOffers } from "@/components/lot/lot-activity"
import { ChainActivity } from "@/components/lot/chain-activity"
import { useApi } from "@/lib/api"
import { useWallet } from "@/lib/wallet/wallet-provider"
import { cropTypeInfo } from "@/lib/crops"
import { certificateSerial } from "@/lib/certificate"
import { displayName, formatDate, formatQty } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Auction, Bid, Crop } from "@/lib/types/database"

export function LotView({ initial }: { initial: Crop }) {
  const { user } = useWallet()
  const { data: crop = initial, mutate } = useApi<Crop>(`/api/crops/${initial.id}`, { fallbackData: initial, refreshInterval: initial.status === "auction" ? 8000 : 0 })
  const auctionId = crop.current_auction?.id
  const { data: auctionData, mutate: mutateAuction } = useApi<{ auction: Auction; bids: Bid[] }>(auctionId ? `/api/auctions/${auctionId}` : null, { refreshInterval: 8000 })
  const [imageIndex, setImageIndex] = useState(0)

  const isOwner = !!user && user.id === crop.farmer_id
  const refresh = async () => {
    await Promise.all([mutate(), mutateAuction()])
  }

  const specs: [React.ReactNode, string, string | null | undefined][] = [
    [<Package key="p" />, "Lot size", `${formatQty(crop.quantity)} ${crop.unit}`],
    [<MapPin key="m" />, "Origin", crop.location],
    [<CalendarDays key="c" />, "Harvested", crop.harvest_date ? formatDate(crop.harvest_date) : null],
    [<Droplets key="d" />, "Moisture", crop.moisture_content != null ? `${crop.moisture_content}%` : null],
    [<ShieldCheck key="s" />, "Grade", crop.quality_grade ? `Grade ${crop.quality_grade}` : null],
    [<Leaf key="l" />, "Organic", crop.organic_certified ? "Certified organic" : "Conventional"],
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 pb-12 sm:px-6 lg:px-8">
      <Link href="/marketplace" className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm transition-colors">
        <ArrowLeft className="size-4" /> Market
      </Link>

      <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
        {/* Gallery */}
        <div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] border">
            <CropMedia crop={crop} index={imageIndex} />
          </div>
          {crop.images.length === 0 && <PhotoCredit photo={cropPhoto(crop.crop_type)} className="mt-2" />}
          {crop.images.length > 1 && (
            <div className="mt-3 flex gap-2.5 overflow-x-auto">
              {crop.images.map((src, i) => (
                <button
                  key={src}
                  onClick={() => setImageIndex(i)}
                  className={cn("size-20 shrink-0 overflow-hidden rounded-xl border-2 transition-colors", i === imageIndex ? "border-signal" : "border-transparent opacity-70 hover:opacity-100")}
                  aria-label={`Show photo ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Summary + actions */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="flex flex-wrap items-center gap-2">
            <CropStatusPill status={crop.status} />
            <Pill>{cropTypeInfo(crop.crop_type).label}{crop.variety ? ` · ${crop.variety}` : ""}</Pill>
            {crop.nft_minted ? <Pill tone="signal"><BadgeCheck className="size-3" /> On-chain #{crop.nft_token_id}</Pill> : <Pill tone="gold">{certificateSerial(crop.content_hash)}</Pill>}
          </div>
          <h1 className="font-display mt-4 text-[2.2rem] leading-[1.05] sm:text-[2.8rem]">{crop.title}</h1>
          <div className="mt-5 flex items-center gap-3">
            <Avatar address={crop.farmer?.wallet_address} name={crop.farmer?.display_name} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-medium">
                {displayName(crop.farmer)}
                {crop.farmer?.verified && <BadgeCheck className="text-signal size-4" aria-label="Verified grower" />}
              </div>
              <div className="text-muted-foreground text-[13px]">{crop.farmer?.location ?? "Grower"}{isOwner && " · this is your lot"}</div>
            </div>
          </div>

          <ActionPanel crop={crop} auction={auctionData?.auction ?? crop.current_auction ?? null} isOwner={isOwner} onChange={refresh} />
        </div>
      </div>

      {/* Details */}
      <div className="mt-16 grid gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
        <div className="flex flex-col gap-12">
          <section>
            <h2 className="font-display text-3xl">About this lot</h2>
            <p className="mt-4 max-w-[68ch] text-[15.5px] leading-relaxed whitespace-pre-line">{crop.description}</p>
            <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-3">
              {specs.map(([icon, label, value]) => (
                <div key={label} className="bg-card p-4">
                  <dt className="text-muted-foreground flex items-center gap-1.5 text-xs [&_svg]:size-3.5">{icon}{label}</dt>
                  <dd className="mt-1.5 text-[15px]">{value ?? "—"}</dd>
                </div>
              ))}
            </dl>
            {crop.storage_conditions && (
              <div className="bg-surface-2/50 mt-4 flex gap-3 rounded-2xl border p-4 text-sm">
                <Warehouse className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div>
                  <div className="font-medium">Storage</div>
                  <p className="text-muted-foreground mt-0.5 leading-relaxed">{crop.storage_conditions}</p>
                </div>
              </div>
            )}
          </section>

          <ChainActivity crop={crop} />
          {auctionData && <BidHistory auction={auctionData.auction} bids={auctionData.bids} />}
          {user && <LotOffers crop={crop} isOwner={isOwner} onChange={refresh} />}
        </div>

        <aside className="flex flex-col gap-5">
          <h2 className="font-display text-3xl">Provenance</h2>
          <Certificate crop={crop} farmer={crop.farmer} />
          <div className="panel-flat divide-y text-sm">
            <Row label="Content hash"><span className="font-mono text-[12.5px] break-all">{crop.content_hash}</span></Row>
            <Row label="Grower wallet">{crop.farmer && <Address value={crop.farmer.wallet_address} />}</Row>
            {crop.nft_minted && crop.nft_token_id != null && <Row label="NFT"><Link href={`/token/${crop.nft_token_id}`} className="text-gold font-mono text-[12.5px] underline decoration-gold/40 underline-offset-4">Seed2Store Certificate #{crop.nft_token_id}</Link></Row>}
            {crop.nft_minted && crop.nft_transaction_hash && <Row label="Mint transaction"><Link href={`/chain/tx/${crop.nft_transaction_hash}`} className="font-mono text-[12.5px] underline decoration-border-strong underline-offset-4">{crop.nft_transaction_hash.slice(0, 10)}…{crop.nft_transaction_hash.slice(-6)}</Link></Row>}
            {crop.metadata_uri && (
              <Row label="Token metadata">
                <a href={crop.metadata_uri.startsWith("ipfs://") ? `https://ipfs.io/ipfs/${crop.metadata_uri.slice(7)}` : crop.metadata_uri} target="_blank" rel="noreferrer" className="font-mono text-[12.5px] underline decoration-border-strong underline-offset-4">
                  {crop.metadata_uri.startsWith("ipfs://") ? crop.metadata_uri.slice(0, 22) + "…" : "View JSON"}
                </a>
              </Row>
            )}
            <Row label="Registered">{formatDate(crop.created_at, true)}</Row>
          </div>
          <Link href={`/verify?q=${crop.id}`} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm underline decoration-border-strong underline-offset-4">
            <ShieldCheck className="size-4" /> Run an independent integrity check
          </Link>
        </aside>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <span className="text-muted-foreground shrink-0 text-[13px]">{label}</span>
      <span className="min-w-0 sm:text-right">{children}</span>
    </div>
  )
}
