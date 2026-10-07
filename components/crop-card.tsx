import Link from "next/link"
import { BadgeCheck, Leaf, MapPin } from "lucide-react"
import { CropMedia } from "@/components/crop-art"
import { Countdown, Pill } from "@/components/bits"
import { cropTypeInfo } from "@/lib/crops"
import { displayName, formatQty, formatUSD, minimumNextBid } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Crop } from "@/lib/types/database"

export function CropCard({ crop, className }: { crop: Crop; className?: string }) {
  const auction = crop.current_auction
  const unitAsk = crop.buyout_price ?? crop.starting_price ?? crop.minimum_price

  return (
    <Link href={`/crop/${crop.id}`} className={cn("group panel lift flex flex-col overflow-hidden", className)}>
      <div className="relative aspect-[4/3] overflow-hidden">
        <CropMedia crop={crop} className="transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.04]" />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          {auction ? (
            <Pill tone="live" dot className="glass border-live/30">
              <Countdown end={auction.end_time} compact />
            </Pill>
          ) : crop.status === "sold" ? (
            <Pill tone="gold" className="glass">Sold</Pill>
          ) : (
            <span />
          )}
          {crop.organic_certified && (
            <Pill tone="signal" className="glass border-signal/30">
              <Leaf className="size-3" /> Organic
            </Pill>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="text-muted-foreground flex items-center gap-2 text-[12px]">
          <span>{cropTypeInfo(crop.crop_type).label}</span>
          {crop.quality_grade && (
            <>
              <span className="bg-border-strong size-1 rounded-full" />
              <span>Grade {crop.quality_grade}</span>
            </>
          )}
          {crop.nft_minted && (
            <span className="text-signal ml-auto inline-flex items-center gap-1">
              <BadgeCheck className="size-3.5" /> On-chain
            </span>
          )}
        </div>
        <h3 className="font-display mt-1.5 line-clamp-2 text-[1.55rem] leading-[1.1]">{crop.title}</h3>
        <p className="text-muted-foreground mt-2 flex items-center gap-1.5 truncate text-[13px]">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{crop.location ?? "Origin undisclosed"}</span>
          <span className="opacity-60">·</span>
          <span className="truncate">{displayName(crop.farmer)}</span>
        </p>

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <div>
            <div className="text-muted-foreground text-[11.5px]">{auction ? (auction.current_highest_bid ? "Current bid · lot" : "Opening bid · lot") : "Buy now"}</div>
            <div className="tabular text-xl font-medium tracking-tight">
              {auction ? formatUSD(auction.current_highest_bid ?? minimumNextBid(auction)) : (
                <>
                  {formatUSD(unitAsk, { cents: (unitAsk ?? 0) < 100 })}
                  <span className="text-muted-foreground text-sm font-normal"> /{crop.unit}</span>
                </>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-muted-foreground text-[11.5px]">{auction ? `${auction.total_bids} ${auction.total_bids === 1 ? "bid" : "bids"}` : "Available"}</div>
            <div className="tabular text-sm">{formatQty(crop.quantity)} {crop.unit}</div>
          </div>
        </div>
      </div>
    </Link>
  )
}

export function CropCardSkeleton() {
  return (
    <div className="panel-flat overflow-hidden">
      <div className="bg-muted/60 aspect-[4/3] animate-pulse" />
      <div className="space-y-3 p-5">
        <div className="bg-muted/60 h-3 w-24 animate-pulse rounded" />
        <div className="bg-muted/60 h-6 w-3/4 animate-pulse rounded" />
        <div className="bg-muted/60 h-3 w-1/2 animate-pulse rounded" />
        <div className="bg-muted/60 mt-6 h-6 w-28 animate-pulse rounded" />
      </div>
    </div>
  )
}
