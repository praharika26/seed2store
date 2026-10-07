"use client"

import Link from "next/link"
import { useState } from "react"
import { BadgeCheck, Gavel, Loader2, MessageSquareText, RotateCcw, ScanLine, ShoppingCart, Undo2, Wallet } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Countdown, Pill } from "@/components/bits"
import { api, errorMessage } from "@/lib/api"
import { useWallet } from "@/lib/wallet/wallet-provider"
import { useLotActions } from "@/lib/wallet/use-lot-actions"
import { chainConfig } from "@/lib/config"
import { formatEth, formatQty, formatUSD, minimumNextBid } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Auction, Crop } from "@/lib/types/database"

export function ActionPanel({ crop, auction, isOwner, onChange }: { crop: Crop; auction: Auction | null; isOwner: boolean; onChange: () => Promise<void> }) {
  const { user, setConnectOpen } = useWallet()
  const actions = useLotActions()
  const liveAuction = auction && auction.status === "active" ? auction : null

  return (
    <div className="panel mt-7 overflow-hidden">
      {liveAuction ? (
        <AuctionBox crop={crop} auction={liveAuction} isOwner={isOwner} actions={actions} onChange={onChange} />
      ) : crop.status === "active" ? (
        isOwner ? <OwnerBox crop={crop} actions={actions} onChange={onChange} /> : <BuyBox crop={crop} actions={actions} onChange={onChange} />
      ) : crop.status === "sold" ? (
        <div className="p-6">
          <Pill tone="gold">Sold</Pill>
          <p className="font-display mt-3 text-2xl">This lot has found its buyer.</p>
          <p className="text-muted-foreground mt-1.5 text-sm">The certificate stays public so anyone downstream can still verify its origin.</p>
          {auction?.blockchain_id && !auction.chain_finalized && user && <FinalizeButton auction={auction} actions={actions} onChange={onChange} />}
          {user && (
            <Button asChild variant="outline" className="mt-5">
              <Link href={isOwner ? "/orders?tab=sales" : "/orders"}>View orders</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="p-6">
          <Pill>Withdrawn</Pill>
          <p className="font-display mt-3 text-2xl">{isOwner ? "You've taken this lot off the market." : "The grower has withdrawn this lot."}</p>
          {isOwner && (
            <Button className="mt-5" onClick={() => setListing(crop.id, "relist", onChange)}>
              <RotateCcw /> Relist lot
            </Button>
          )}
          {auction?.blockchain_id && !auction.chain_finalized && user && <FinalizeButton auction={auction} actions={actions} onChange={onChange} />}
        </div>
      )}

      {!user && crop.status !== "sold" && crop.status !== "expired" && (
        <div className="bg-surface-2/60 flex items-center justify-between gap-4 border-t px-6 py-4">
          <span className="text-muted-foreground text-sm">Connect a wallet to bid, buy or make an offer.</span>
          <Button size="sm" onClick={() => setConnectOpen(true)}><Wallet /> Connect</Button>
        </div>
      )}
    </div>
  )
}

type Actions = ReturnType<typeof useLotActions>

async function setListing(id: string, action: "delist" | "relist", onChange: () => Promise<void>) {
  try {
    await api(`/api/crops/${id}`, { method: "PATCH", json: { action } })
    toast.success(action === "delist" ? "Lot withdrawn from the market" : "Lot is back on the market")
    await onChange()
  } catch (e) {
    toast.error(errorMessage(e))
  }
}

// ---------------------------------------------------------------------------

function AuctionBox({ crop, auction, isOwner, actions, onChange }: { crop: Crop; auction: Auction; isOwner: boolean; actions: Actions; onChange: () => Promise<void> }) {
  const { user } = useWallet()
  const min = minimumNextBid(auction)
  const [amount, setAmount] = useState("")
  const value = Number(amount)
  const valid = value >= min
  const reserveMet = auction.current_highest_bid != null && auction.current_highest_bid >= (auction.reserve_price ?? 0)
  const leading = user && auction.highest_bidder_id === user.id

  const submit = async () => {
    if (!valid) return
    const ok = await actions.placeBid(auction, value)
    if (ok) {
      setAmount("")
      await onChange()
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b px-6 py-3.5">
        <span className="text-live flex items-center gap-2 text-[13px] font-medium"><span className="live-dot" /> Live auction</span>
        <span className="text-muted-foreground text-[13px]">Closes in <Countdown end={auction.end_time} className="text-foreground font-medium" /></span>
      </div>
      <div className="grid grid-cols-2 gap-6 px-6 pt-5">
        <div>
          <div className="text-muted-foreground text-xs">{auction.current_highest_bid ? "Top bid · whole lot" : "Opening bid · whole lot"}</div>
          <div className="tabular mt-1 text-[2.4rem] leading-none font-medium tracking-tight">{formatUSD(auction.current_highest_bid ?? auction.starting_price)}</div>
          <div className="text-muted-foreground tabular mt-1.5 font-mono text-xs">≈ {formatEth(auction.current_highest_bid ?? auction.starting_price)} · {formatUSD((auction.current_highest_bid ?? auction.starting_price) / crop.quantity, { cents: true })}/{crop.unit}</div>
        </div>
        <div className="flex flex-col items-start gap-2 pt-1">
          <Pill tone={auction.reserve_price ? (reserveMet ? "signal" : "muted") : "muted"}>{auction.reserve_price ? (reserveMet ? "Reserve met" : `Reserve ${formatUSD(auction.reserve_price)}`) : "No reserve"}</Pill>
          <span className="text-muted-foreground text-xs">{auction.total_bids} {auction.total_bids === 1 ? "bid" : "bids"} · step {formatUSD(auction.bid_increment)}</span>
          {leading && <Pill tone="signal" dot>You're leading</Pill>}
        </div>
      </div>

      {isOwner ? (
        <div className="px-6 pt-5 pb-6">
          <p className="text-muted-foreground text-sm leading-relaxed">
            Your auction is running. When it closes above the reserve, an order opens for the winner automatically{auction.blockchain_id ? " and the escrowed funds can be released on-chain." : "."}
          </p>
          {auction.total_bids === 0 && !auction.blockchain_id && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={async () => {
                try {
                  await api(`/api/auctions/${auction.id}`, { method: "DELETE" })
                  toast.success("Auction cancelled, lot relisted")
                  await onChange()
                } catch (e) {
                  toast.error(errorMessage(e))
                }
              }}
            >
              <Undo2 /> Cancel auction
            </Button>
          )}
        </div>
      ) : user ? (
        <div className="px-6 pt-5 pb-6">
          <Label htmlFor="bid" className="text-muted-foreground text-xs font-normal">Your bid for the whole lot (USD)</Label>
          <div className="mt-2 flex gap-2">
            <div className="relative flex-1">
              <span className="text-muted-foreground absolute top-1/2 left-3.5 -translate-y-1/2">$</span>
              <Input id="bid" type="number" inputMode="decimal" min={min} step={auction.bid_increment} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={min.toString()} className="tabular pl-7 text-lg" onKeyDown={(e) => e.key === "Enter" && submit()} />
            </div>
            <Button variant="live" size="lg" className="h-11" disabled={!valid || actions.busy === "bid"} onClick={submit}>
              {actions.busy === "bid" ? <Loader2 className="animate-spin" /> : <Gavel />} Bid
            </Button>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {[1, 2, 5].map((k) => (
              <button key={k} onClick={() => setAmount(String(min + (k - 1) * auction.bid_increment))} className="hover:border-border-strong hover:bg-accent tabular rounded-full border px-3 py-1 text-xs transition-colors">
                {formatUSD(min + (k - 1) * auction.bid_increment)}
              </button>
            ))}
          </div>
          <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
            {amount && !valid ? <span className="text-destructive">Minimum bid is {formatUSD(min)}.</span> : auction.blockchain_id && chainConfig.enabled ? `≈ ${formatEth(value || min)} escrowed by the contract; refunded automatically if you're outbid.` : "Bids are binding. If you win, an order opens and you settle with the grower."}
          </p>
        </div>
      ) : null}
    </div>
  )
}

function FinalizeButton({ auction, actions, onChange }: { auction: Auction; actions: Actions; onChange: () => Promise<void> }) {
  if (!chainConfig.enabled) return null
  return (
    <div className="bg-signal-soft mt-5 rounded-2xl border border-signal/20 p-4">
      <p className="text-sm leading-relaxed">This auction escrowed funds on-chain. Settle it to pay the grower and transfer the certificate, or refund the bidder if the reserve wasn't met.</p>
      <Button className="mt-3" size="sm" disabled={actions.busy === "finalize"} onClick={async () => (await actions.finalize(auction)) && onChange()}>
        {actions.busy === "finalize" ? <Loader2 className="animate-spin" /> : <ScanLine />} Settle on-chain
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------

function BuyBox({ crop, actions, onChange }: { crop: Crop; actions: Actions; onChange: () => Promise<void> }) {
  const { user } = useWallet()
  const [buyOpen, setBuyOpen] = useState(false)
  const [offerOpen, setOfferOpen] = useState(false)
  const total = crop.buyout_price ? crop.buyout_price * crop.quantity : null
  const onchain = chainConfig.enabled && crop.nft_minted

  return (
    <div className="p-6">
      {total ? (
        <>
          <div className="text-muted-foreground text-xs">Buy the whole lot now</div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="tabular text-[2.4rem] leading-none font-medium tracking-tight">{formatUSD(total)}</span>
            <span className="text-muted-foreground tabular text-sm">{formatUSD(crop.buyout_price, { cents: true })}/{crop.unit}</span>
          </div>
          <div className="text-muted-foreground tabular mt-1.5 font-mono text-xs">≈ {formatEth(total)} · {formatQty(crop.quantity)} {crop.unit}</div>
        </>
      ) : (
        <>
          <div className="text-muted-foreground text-xs">Asking from</div>
          <div className="tabular mt-1 text-[2.4rem] leading-none font-medium tracking-tight">
            {formatUSD(crop.starting_price ?? crop.minimum_price, { cents: true })}
            <span className="text-muted-foreground text-base font-normal"> /{crop.unit}</span>
          </div>
          <div className="text-muted-foreground mt-1.5 text-xs">Offers only. This grower hasn't set a buy-now price.</div>
        </>
      )}

      {user && (
        <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
          {total && (
            <Button size="lg" onClick={() => setBuyOpen(true)} disabled={actions.busy === "buy"}>
              <ShoppingCart /> Buy now
            </Button>
          )}
          <Button size="lg" variant="outline" onClick={() => setOfferOpen(true)} className={cn(!total && "sm:col-span-2")}>
            <MessageSquareText /> Make an offer
          </Button>
        </div>
      )}
      {crop.pending_offers ? <p className="text-muted-foreground mt-4 text-xs">{crop.pending_offers} other {crop.pending_offers === 1 ? "offer is" : "offers are"} pending on this lot.</p> : null}

      <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-3xl font-normal">Buy {crop.title}</DialogTitle>
            <DialogDescription>You&apos;re buying the full lot of {formatQty(crop.quantity)} {crop.unit}.</DialogDescription>
          </DialogHeader>
          <div className="panel-flat divide-y text-sm">
            <Line k="Price" v={`${formatUSD(crop.buyout_price, { cents: true })} × ${formatQty(crop.quantity)} ${crop.unit}`} />
            <Line k="Total" v={<span className="tabular text-lg font-medium">{formatUSD(total)}</span>} />
            <Line k="Settlement" v={onchain ? `${formatEth(total)} on ${chainConfig.name}` : "Direct with the grower"} />
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {onchain ? "The contract pays the grower (less a 2.5% platform fee) and transfers the certificate NFT to your wallet in the same transaction." : "An order opens immediately. The grower confirms once your payment arrives, then ships."}
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBuyOpen(false)}>Cancel</Button>
            <Button
              disabled={actions.busy === "buy"}
              onClick={async () => {
                const r = await actions.buyNow(crop)
                if (r) {
                  setBuyOpen(false)
                  await onChange()
                }
              }}
            >
              {actions.busy === "buy" ? <Loader2 className="animate-spin" /> : onchain ? <Wallet /> : <ShoppingCart />} Confirm purchase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OfferDialog crop={crop} open={offerOpen} onOpenChange={setOfferOpen} onDone={onChange} />
    </div>
  )
}

function Line({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  )
}

function OfferDialog({ crop, open, onOpenChange, onDone }: { crop: Crop; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => Promise<void> }) {
  const wholeLot = crop.nft_minted
  const [quantity, setQuantity] = useState(String(crop.quantity))
  const [price, setPrice] = useState(String(crop.starting_price ?? crop.minimum_price ?? ""))
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const q = Number(quantity)
  const p = Number(price)
  const total = q > 0 && p > 0 ? q * p : 0
  const belowMin = crop.minimum_price != null && p > 0 && p < crop.minimum_price

  const submit = async () => {
    setBusy(true)
    try {
      await api("/api/offers", { method: "POST", json: { crop_id: crop.id, quantity: q, price_per_unit: p, message, expires_in_hours: 72 } })
      toast.success("Offer sent", { description: "The grower has 72 hours to respond." })
      onOpenChange(false)
      setMessage("")
      await onDone()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-3xl font-normal">Make an offer</DialogTitle>
          <DialogDescription>Private to you and the grower. They can accept, decline or let it expire in 72 hours.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="offer-qty">Quantity ({crop.unit})</Label>
            <Input id="offer-qty" type="number" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} max={crop.quantity} disabled={wholeLot} className="tabular" />
            <p className="text-muted-foreground text-xs">{wholeLot ? "Certified lots trade whole." : `Up to ${formatQty(crop.quantity)} ${crop.unit}`}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="offer-price">Price per {crop.unit} (USD)</Label>
            <Input id="offer-price" type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="tabular" />
            <p className={cn("text-xs", belowMin ? "text-live" : "text-muted-foreground")}>{belowMin ? `Below the grower's minimum of ${formatUSD(crop.minimum_price, { cents: true })}` : crop.starting_price ? `Asking ${formatUSD(crop.starting_price, { cents: true })}` : " "}</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="offer-msg">Note to the grower <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Textarea id="offer-msg" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Delivery window, pickup, payment terms…" rows={3} />
        </div>
        <div className="bg-surface-2/60 flex items-center justify-between rounded-2xl border px-4 py-3">
          <span className="text-muted-foreground text-sm">Offer total</span>
          <span className="tabular text-xl font-medium">{formatUSD(total)}</span>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={busy || !(q > 0 && p > 0) || q > crop.quantity} onClick={submit}>
            {busy && <Loader2 className="animate-spin" />} Send offer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------

function OwnerBox({ crop, actions, onChange }: { crop: Crop; actions: Actions; onChange: () => Promise<void> }) {
  const [auctionOpen, setAuctionOpen] = useState(false)
  const needsMint = chainConfig.enabled && !crop.nft_minted

  return (
    <div className="p-6">
      <div className="text-muted-foreground text-xs">Your listing</div>
      <div className="mt-2 grid grid-cols-3 gap-4">
        <Mini label="Minimum" value={formatUSD(crop.minimum_price, { cents: true })} unit={crop.unit} />
        <Mini label="Asking" value={formatUSD(crop.starting_price, { cents: true })} unit={crop.unit} />
        <Mini label="Buy now" value={crop.buyout_price ? formatUSD(crop.buyout_price, { cents: true }) : "Off"} unit={crop.buyout_price ? crop.unit : undefined} />
      </div>

      {needsMint && (
        <div className="bg-gold-soft mt-6 rounded-2xl border border-gold/25 p-4">
          <div className="flex items-start gap-3">
            <ScanLine className="text-gold mt-0.5 size-5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Certify this lot on {chainConfig.name}</p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">Mint the certificate as an NFT so buyers can verify it on-chain and pay through escrow.</p>
              <Button size="sm" variant="gold" className="mt-3" disabled={actions.busy === "mint"} onClick={async () => (await actions.mint(crop)) && onChange()}>
                {actions.busy === "mint" ? <Loader2 className="animate-spin" /> : <BadgeCheck />} Mint certificate
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
        <Button size="lg" variant="live" onClick={() => setAuctionOpen(true)}><Gavel /> Start auction</Button>
        <Button size="lg" variant="outline" onClick={() => setListing(crop.id, "delist", onChange)}><Undo2 /> Withdraw</Button>
      </div>
      {crop.pending_offers ? (
        <Link href="/offers" className="text-signal mt-4 inline-block text-sm underline underline-offset-4">
          {crop.pending_offers} pending {crop.pending_offers === 1 ? "offer" : "offers"} to review
        </Link>
      ) : null}
      <StartAuctionDialog crop={crop} open={auctionOpen} onOpenChange={setAuctionOpen} actions={actions} onDone={onChange} />
    </div>
  )
}

function Mini({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-[11px]">{label}</div>
      <div className="tabular text-lg font-medium">{value}{unit && <span className="text-muted-foreground text-xs font-normal">/{unit}</span>}</div>
    </div>
  )
}

const DURATIONS = [
  { h: 6, label: "6 hours" },
  { h: 24, label: "1 day" },
  { h: 72, label: "3 days" },
  { h: 168, label: "7 days" },
]

function StartAuctionDialog({ crop, open, onOpenChange, actions, onDone }: { crop: Crop; open: boolean; onOpenChange: (o: boolean) => void; actions: Actions; onDone: () => Promise<void> }) {
  const lotMin = (crop.minimum_price ?? 0) * crop.quantity
  const suggestedStart = Math.ceil((crop.starting_price ?? crop.minimum_price ?? 0) * crop.quantity)
  const [start, setStart] = useState(String(suggestedStart))
  const [reserve, setReserve] = useState("")
  const [hours, setHours] = useState(24)
  const s = Number(start)
  const r = reserve ? Number(reserve) : undefined
  const increment = Math.max(1, Math.round(s * 0.01))
  const error = s < lotMin ? `Start at or above your minimum of ${formatUSD(lotMin)} for the lot.` : r != null && r < s ? "Reserve can't be below the opening bid." : null
  const onchain = chainConfig.enabled && crop.nft_minted

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-3xl font-normal">Auction this lot</DialogTitle>
          <DialogDescription>Bids are for all {formatQty(crop.quantity)} {crop.unit}. Pending offers will be closed when the auction opens.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="a-start">Opening bid (USD, lot)</Label>
            <Input id="a-start" type="number" value={start} onChange={(e) => setStart(e.target.value)} className="tabular" />
            <p className="text-muted-foreground text-xs">≈ {formatUSD(s / crop.quantity, { cents: true })}/{crop.unit}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="a-reserve">Reserve <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input id="a-reserve" type="number" value={reserve} onChange={(e) => setReserve(e.target.value)} placeholder="No reserve" className="tabular" />
            <p className="text-muted-foreground text-xs">Lowest price you'll accept.</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Duration</Label>
          <div className="grid grid-cols-4 gap-2">
            {DURATIONS.map((d) => (
              <button key={d.h} onClick={() => setHours(d.h)} aria-pressed={hours === d.h} className={cn("rounded-xl border py-2.5 text-sm transition-colors", hours === d.h ? "bg-foreground text-background border-foreground" : "hover:bg-accent")}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Minimum step {formatUSD(increment)} (1%). {onchain ? "Created on-chain: bids are escrowed by the contract." : "Runs off-chain: the winner settles payment with you directly."}
        </p>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="live"
            disabled={!!error || !(s > 0) || actions.busy === "auction"}
            onClick={async () => {
              const ok = await actions.startAuction(crop, { startingUsd: s, reserveUsd: r, incrementUsd: increment, hours })
              if (ok) {
                onOpenChange(false)
                await onDone()
              }
            }}
          >
            {actions.busy === "auction" ? <Loader2 className="animate-spin" /> : <Gavel />} Open auction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
