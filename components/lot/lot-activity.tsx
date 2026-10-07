"use client"

import { useState } from "react"
import { Check, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Avatar, OfferStatusPill, TxHash } from "@/components/bits"
import { api, errorMessage, useApi } from "@/lib/api"
import { displayName, formatQty, formatUSD, timeAgo } from "@/lib/format"
import type { Auction, Bid, Crop, Offer } from "@/lib/types/database"

export function BidHistory({ auction, bids }: { auction: Auction; bids: Bid[] }) {
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-3xl">Bid history</h2>
        <span className="text-muted-foreground text-sm tabular">{bids.length} {bids.length === 1 ? "bid" : "bids"}</span>
      </div>
      {bids.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">No bids yet. The opening bid is {formatUSD(auction.starting_price)}.</p>
      ) : (
        <ol className="mt-5 flex flex-col">
          {bids.map((b, i) => (
            <li key={b.id} className="flex items-center gap-3 border-t py-3.5 last:border-b">
              <Avatar address={b.bidder?.wallet_address} name={b.bidder?.display_name} className="size-8 text-[10px]" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{displayName(b.bidder)}{i === 0 && <span className="text-signal ml-2 text-xs font-normal">{auction.status === "active" ? "leading" : "winning bid"}</span>}</div>
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  {timeAgo(b.bid_time)}
                  {b.transaction_hash && <TxHash value={b.transaction_hash} className="text-[11px]" />}
                </div>
              </div>
              <span className={`tabular font-medium ${i === 0 ? "" : "text-muted-foreground"}`}>{formatUSD(b.amount)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

/** Owner sees every offer with accept/decline; a buyer sees only their own. */
export function LotOffers({ crop, isOwner, onChange }: { crop: Crop; isOwner: boolean; onChange: () => Promise<void> }) {
  const { data, mutate } = useApi<Offer[]>(`/api/crops/${crop.id}/offers`)
  const [busy, setBusy] = useState<string | null>(null)
  if (!data?.length) return null

  const respond = async (offer: Offer, action: "accept" | "reject" | "withdraw") => {
    setBusy(offer.id + action)
    try {
      await api(`/api/offers/${offer.id}`, { method: "PATCH", json: { action } })
      toast.success(action === "accept" ? "Offer accepted. An order has been opened" : action === "reject" ? "Offer declined" : "Offer withdrawn")
      await Promise.all([mutate(), onChange()])
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section>
      <h2 className="font-display text-3xl">{isOwner ? "Offers on this lot" : "Your offers"}</h2>
      <div className="mt-5 flex flex-col gap-3">
        {data.map((o) => (
          <div key={o.id} className="panel-flat p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Avatar address={o.buyer?.wallet_address} name={o.buyer?.display_name} className="size-8 text-[10px]" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{isOwner ? displayName(o.buyer) : "You"}</div>
                <div className="text-muted-foreground text-xs">{timeAgo(o.created_at)}</div>
              </div>
              <div className="text-right">
                <div className="tabular font-medium">{formatUSD(o.total_amount)}</div>
                <div className="text-muted-foreground tabular text-xs">{formatQty(o.quantity)} {crop.unit} × {formatUSD(o.price_per_unit, { cents: true })}</div>
              </div>
              <OfferStatusPill status={o.status} />
            </div>
            {o.message && <p className="bg-surface-2/50 mt-3 rounded-xl px-3.5 py-2.5 text-sm leading-relaxed">“{o.message}”</p>}
            {o.response_message && <p className="text-muted-foreground mt-2 text-sm">Reply: {o.response_message}</p>}
            {o.status === "pending" && (
              <div className="mt-3 flex gap-2">
                {isOwner ? (
                  <>
                    <Button size="sm" disabled={!!busy} onClick={() => respond(o, "accept")}>{busy === o.id + "accept" ? <Loader2 className="animate-spin" /> : <Check />} Accept</Button>
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => respond(o, "reject")}><X /> Decline</Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" disabled={!!busy} onClick={() => respond(o, "withdraw")}>Withdraw offer</Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
