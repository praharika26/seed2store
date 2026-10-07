"use client"

import Link from "next/link"
import { useState } from "react"
import { BadgeCheck, Sprout } from "lucide-react"
import { AuthGate } from "@/components/auth-gate"
import { CropMedia } from "@/components/crop-art"
import { Countdown, CropStatusPill, Empty, PageHeader, Skeleton } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { useApi } from "@/lib/api"
import { formatDate, formatQty, formatUSD } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Crop, CropStatus } from "@/lib/types/database"

const FILTERS: { value: CropStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Listed" },
  { value: "auction", label: "In auction" },
  { value: "sold", label: "Sold" },
  { value: "expired", label: "Withdrawn" },
]

export default function MyCropsPage() {
  return (
    <AuthGate role="farmer">
      <MyCrops />
    </AuthGate>
  )
}

function MyCrops() {
  const { data, isLoading } = useApi<Crop[]>("/api/crops/mine")
  const [filter, setFilter] = useState<CropStatus | "all">("all")
  const rows = data?.filter((c) => filter === "all" || c.status === filter) ?? []

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader title={<>My <span className="italic">lots</span></>} description="Everything you've registered, with its live status." actions={<Button asChild><Link href="/register-crop"><Sprout /> List a lot</Link></Button>} />

      <div className="mb-6 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => {
          const count = f.value === "all" ? data?.length : data?.filter((c) => c.status === f.value).length
          return (
            <button key={f.value} onClick={() => setFilter(f.value)} aria-pressed={filter === f.value} className={cn("h-9 shrink-0 rounded-full border px-4 text-[13px] transition-colors", filter === f.value ? "bg-foreground text-background border-foreground" : "text-muted-foreground hover:text-foreground")}>
              {f.label} <span className="tabular ml-1 opacity-60">{count ?? ""}</span>
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <Skeleton className="h-72" />
      ) : !data?.length ? (
        <Empty icon={<Sprout />} title="No lots yet" description="List your first harvest. It takes about two minutes and buyers can bid the moment it's live." action={<Button asChild><Link href="/register-crop">List a lot</Link></Button>} />
      ) : rows.length === 0 ? (
        <Empty title="Nothing in this view" description="Try another filter." />
      ) : (
        <div className="panel-flat divide-y overflow-hidden">
          <div className="text-muted-foreground hidden grid-cols-[1fr_130px_150px_150px_120px] gap-4 px-5 py-3 text-xs md:grid">
            <span>Lot</span><span>Status</span><span className="text-right">Quantity</span><span className="text-right">Price</span><span className="text-right">Activity</span>
          </div>
          {rows.map((c) => (
            <Link key={c.id} href={`/crop/${c.id}`} className="hover:bg-accent/40 grid grid-cols-[56px_1fr] items-center gap-4 px-5 py-4 transition-colors md:grid-cols-[56px_1fr_130px_150px_150px_120px]">
              <div className="size-14 overflow-hidden rounded-xl"><CropMedia crop={c} /></div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 truncate font-medium">{c.title}{c.nft_minted && <BadgeCheck className="text-signal size-4 shrink-0" />}</div>
                <div className="text-muted-foreground text-xs">Listed {formatDate(c.created_at)}</div>
              </div>
              <div className="col-start-2 md:col-start-auto"><CropStatusPill status={c.status} /></div>
              <div className="tabular hidden text-right text-sm md:block">{formatQty(c.quantity)} {c.unit}</div>
              <div className="tabular hidden text-right text-sm md:block">
                {c.current_auction ? formatUSD(c.current_auction.current_highest_bid ?? c.current_auction.starting_price) : `${formatUSD(c.buyout_price ?? c.starting_price, { cents: true })}/${c.unit}`}
              </div>
              <div className="text-muted-foreground hidden text-right text-xs md:block">
                {c.current_auction ? <><Countdown end={c.current_auction.end_time} compact /> · {c.current_auction.total_bids} bids</> : c.pending_offers ? <span className="text-live">{c.pending_offers} offers</span> : "—"}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
