"use client"

import Link from "next/link"
import { useState } from "react"
import { Gavel, Trophy } from "lucide-react"
import { CropMedia } from "@/components/crop-art"
import { Countdown, Empty, PageHeader, Pill, Skeleton } from "@/components/bits"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useApi } from "@/lib/api"
import { displayName, formatDate, formatEth, formatQty, formatUSD, minimumNextBid } from "@/lib/format"
import type { Auction } from "@/lib/types/database"

export default function AuctionsPage() {
  const [tab, setTab] = useState<"active" | "ended">("active")
  const { data, isLoading } = useApi<Auction[]>(`/api/auctions?status=${tab}`, { refreshInterval: tab === "active" ? 10_000 : 0 })

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        title={<>Auction <span className="italic">floor</span></>}
        description="Whole lots, open bidding, with a reserve set by the grower. A bid in the final ten minutes adds ten more, so the best price wins rather than the fastest click."
        actions={
          <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "ended")}>
            <TabsList>
              <TabsTrigger value="active">Live</TabsTrigger>
              <TabsTrigger value="ended">Closed</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {isLoading && !data ? (
        <div className="flex flex-col gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : !data?.length ? (
        <Empty
          icon={tab === "active" ? <Gavel /> : <Trophy />}
          title={tab === "active" ? "No auctions running" : "No closed auctions yet"}
          description={tab === "active" ? "Growers start auctions from their lot pages. Check back soon, or browse lots you can buy right now." : "Finished auctions and their results will appear here."}
          action={<Link href="/marketplace" className="underline underline-offset-4">Browse the market</Link>}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {data.map((a) => <AuctionRow key={a.id} auction={a} />)}
        </div>
      )}
    </div>
  )
}

function AuctionRow({ auction: a }: { auction: Auction }) {
  const crop = a.crop
  if (!crop) return null
  const live = a.status === "active"
  const reserveMet = a.current_highest_bid != null && a.current_highest_bid >= (a.reserve_price ?? 0)
  return (
    <Link href={`/crop/${crop.id}`} className="panel lift group grid overflow-hidden md:grid-cols-[260px_1fr_auto]">
      <div className="relative aspect-[16/9] overflow-hidden md:aspect-auto">
        <CropMedia crop={crop} className="transition-transform duration-700 group-hover:scale-[1.04]" />
      </div>
      <div className="flex flex-col justify-center p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          {live ? <Pill tone="live" dot>Live</Pill> : a.winner_id ? <Pill tone="gold">Sold</Pill> : <Pill>No sale</Pill>}
          {a.reserve_price ? <Pill tone={reserveMet ? "signal" : "muted"}>{reserveMet ? "Reserve met" : "Reserve not met"}</Pill> : <Pill>No reserve</Pill>}
          {a.blockchain_id ? <Pill tone="signal">On-chain escrow</Pill> : null}
        </div>
        <h3 className="font-display mt-3 text-[1.9rem] leading-[1.05]">{crop.title}</h3>
        <p className="text-muted-foreground mt-1.5 text-sm">
          {formatQty(crop.quantity)} {crop.unit} · {crop.location} · {displayName(crop.farmer)}
        </p>
      </div>
      <div className="flex items-center gap-8 border-t p-5 md:border-t-0 md:border-l md:p-6 md:pl-8">
        <div>
          <div className="text-muted-foreground text-xs">{a.current_highest_bid ? (live ? "Top bid" : "Final bid") : "Opens at"}</div>
          <div className="tabular text-2xl font-medium tracking-tight">{formatUSD(a.current_highest_bid ?? minimumNextBid(a))}</div>
          <div className="text-muted-foreground tabular font-mono text-[11px]">≈ {formatEth(a.current_highest_bid ?? minimumNextBid(a))}</div>
        </div>
        <div className="min-w-[110px]">
          <div className="text-muted-foreground text-xs">{live ? "Closes in" : "Closed"}</div>
          {live ? <Countdown end={a.end_time} className="text-xl" /> : <div className="text-sm">{formatDate(a.end_time, true)}</div>}
          <div className="text-muted-foreground text-xs">{a.total_bids} {a.total_bids === 1 ? "bid" : "bids"}{a.highest_bidder ? ` · lead ${displayName(a.highest_bidder)}` : ""}</div>
        </div>
      </div>
    </Link>
  )
}
