"use client"

import Link from "next/link"
import { Gavel } from "lucide-react"
import { AuthGate } from "@/components/auth-gate"
import { CropMedia } from "@/components/crop-art"
import { Countdown, Empty, PageHeader, Pill, Skeleton } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { useApi } from "@/lib/api"
import { formatUSD, minimumNextBid, timeAgo } from "@/lib/format"
import type { Auction, Bid } from "@/lib/types/database"

type Row = Bid & { bid_count: number; standing: "leading" | "outbid" | "won" | "lost"; auction: Auction }

const STANDING = {
  leading: { tone: "signal", label: "Leading" },
  outbid: { tone: "live", label: "Outbid" },
  won: { tone: "gold", label: "Won" },
  lost: { tone: "muted", label: "Didn't win" },
} as const

export default function MyBidsPage() {
  return (
    <AuthGate>
      <MyBids />
    </AuthGate>
  )
}

function MyBids() {
  const { data, isLoading } = useApi<Row[]>("/api/bids", { refreshInterval: 15_000 })
  const live = data?.filter((r) => r.standing === "leading" || r.standing === "outbid") ?? []
  const closed = data?.filter((r) => r.standing === "won" || r.standing === "lost") ?? []

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader title={<>My <span className="italic">bids</span></>} description="Where you stand in every auction you've joined. Outbid? Jump back in before the clock runs out." />
      {isLoading ? (
        <Skeleton className="h-60" />
      ) : !data?.length ? (
        <Empty icon={<Gavel />} title="No bids yet" description="Find a live auction and place your first bid." action={<Button asChild><Link href="/auctions">See live auctions</Link></Button>} />
      ) : (
        <div className="flex flex-col gap-10">
          {live.length > 0 && <List title="Live" rows={live} />}
          {closed.length > 0 && <List title="Closed" rows={closed} />}
        </div>
      )}
    </div>
  )
}

function List({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section>
      <h2 className="text-muted-foreground mb-3 text-sm">{title} · {rows.length}</h2>
      <div className="panel-flat divide-y overflow-hidden">
        {rows.map((r) => {
          const crop = r.auction.crop
          const s = STANDING[r.standing]
          return (
            <Link key={r.id} href={crop ? `/crop/${crop.id}` : "#"} className="hover:bg-accent/40 grid grid-cols-[56px_1fr_auto] items-center gap-4 px-5 py-4 transition-colors">
              <div className="size-14 overflow-hidden rounded-xl">{crop && <CropMedia crop={crop} />}</div>
              <div className="min-w-0">
                <div className="truncate font-medium">{crop?.title}</div>
                <div className="text-muted-foreground text-xs">
                  Your best {formatUSD(r.amount)} · {r.bid_count} {r.bid_count === 1 ? "bid" : "bids"} · {timeAgo(r.bid_time)}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <Pill tone={s.tone} dot={r.standing === "leading"}>{s.label}</Pill>
                {r.auction.status === "active" ? (
                  <span className="text-muted-foreground text-xs">
                    {r.standing === "outbid" ? `Next ${formatUSD(minimumNextBid(r.auction))} · ` : ""}<Countdown end={r.auction.end_time} compact />
                  </span>
                ) : (
                  <span className="text-muted-foreground tabular text-xs">Final {formatUSD(r.auction.current_highest_bid)}</span>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
