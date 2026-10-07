"use client"

import Link from "next/link"
import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Check, Loader2, MessageSquareText, X } from "lucide-react"
import { toast } from "sonner"
import { AuthGate } from "@/components/auth-gate"
import { CropMedia } from "@/components/crop-art"
import { Avatar, Empty, OfferStatusPill, PageHeader, Skeleton } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api, errorMessage, useApi } from "@/lib/api"
import { useWallet } from "@/lib/wallet/wallet-provider"
import { displayName, formatQty, formatUSD, timeAgo } from "@/lib/format"
import type { Offer } from "@/lib/types/database"

export default function OffersPage() {
  return (
    <AuthGate>
      <Suspense>
        <Offers />
      </Suspense>
    </AuthGate>
  )
}

function Offers() {
  const { user } = useWallet()
  const params = useSearchParams()
  const router = useRouter()
  const tab = (params.get("tab") ?? (user?.role === "farmer" ? "received" : "sent")) as "received" | "sent"
  const { data, isLoading, mutate } = useApi<Offer[]>(`/api/offers?type=${tab}`)
  const pending = data?.filter((o) => o.status === "pending") ?? []
  const settled = data?.filter((o) => o.status !== "pending") ?? []

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        title={<><span className="italic">Offers</span></>}
        description={tab === "received" ? "Private offers from buyers on your lots. Accepting one opens an order and reduces the lot's quantity." : "Offers you've made. Growers have 72 hours to reply."}
        actions={
          <Tabs value={tab} onValueChange={(v) => router.replace(`/offers?tab=${v}`)}>
            <TabsList>
              <TabsTrigger value="received">Received</TabsTrigger>
              <TabsTrigger value="sent">Sent</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      {isLoading ? (
        <Skeleton className="h-60" />
      ) : !data?.length ? (
        <Empty
          icon={<MessageSquareText />}
          title={tab === "received" ? "No offers yet" : "You haven't made any offers"}
          description={tab === "received" ? "When a buyer proposes a price on one of your lots, it lands here." : "Open any listed lot and choose “Make an offer” to negotiate privately."}
          action={tab === "sent" ? <Button asChild><Link href="/marketplace">Browse lots</Link></Button> : undefined}
        />
      ) : (
        <div className="flex flex-col gap-10">
          {pending.length > 0 && <Group title="Awaiting a reply" offers={pending} tab={tab} onChange={mutate} />}
          {settled.length > 0 && <Group title="History" offers={settled} tab={tab} onChange={mutate} />}
        </div>
      )}
    </div>
  )
}

function Group({ title, offers, tab, onChange }: { title: string; offers: Offer[]; tab: "received" | "sent"; onChange: () => void }) {
  return (
    <section>
      <h2 className="text-muted-foreground mb-3 text-sm">{title} · {offers.length}</h2>
      <div className="flex flex-col gap-3">
        {offers.map((o) => <OfferCard key={o.id} offer={o} tab={tab} onChange={onChange} />)}
      </div>
    </section>
  )
}

function OfferCard({ offer: o, tab, onChange }: { offer: Offer; tab: "received" | "sent"; onChange: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [replying, setReplying] = useState(false)
  const [reply, setReply] = useState("")
  const crop = o.crop

  const act = async (action: "accept" | "reject" | "withdraw") => {
    setBusy(action)
    try {
      await api(`/api/offers/${o.id}`, { method: "PATCH", json: { action, message: reply || undefined } })
      toast.success(action === "accept" ? "Accepted. An order has been opened" : action === "reject" ? "Offer declined" : "Offer withdrawn")
      onChange()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const ask = crop?.starting_price ?? crop?.minimum_price
  const diff = ask ? ((o.price_per_unit - ask) / ask) * 100 : null

  return (
    <article className="panel overflow-hidden">
      <div className="grid gap-5 p-5 sm:grid-cols-[72px_1fr_auto] sm:items-center">
        {crop && (
          <Link href={`/crop/${crop.id}`} className="hidden size-[72px] overflow-hidden rounded-2xl sm:block"><CropMedia crop={crop} /></Link>
        )}
        <div className="min-w-0">
          <Link href={crop ? `/crop/${crop.id}` : "#"} className="font-display line-clamp-1 text-[1.45rem] leading-tight hover:underline">{crop?.title ?? "Lot"}</Link>
          <div className="text-muted-foreground mt-1 flex items-center gap-2 text-[13px]">
            {tab === "received" ? (
              <><Avatar address={o.buyer?.wallet_address} name={o.buyer?.display_name} className="size-5 text-[8px]" /> {displayName(o.buyer)}</>
            ) : (
              <>to {displayName(crop?.farmer)}</>
            )}
            <span>·</span> {timeAgo(o.created_at)}
          </div>
        </div>
        <div className="flex items-center gap-5 sm:justify-end">
          <div className="text-right">
            <div className="tabular text-xl font-medium">{formatUSD(o.total_amount)}</div>
            <div className="text-muted-foreground tabular text-xs">
              {formatQty(o.quantity)} {crop?.unit} × {formatUSD(o.price_per_unit, { cents: true })}
              {diff != null && <span className={diff >= 0 ? "text-signal" : "text-live"}> · {diff >= 0 ? "+" : ""}{diff.toFixed(0)}% vs ask</span>}
            </div>
          </div>
          <OfferStatusPill status={o.status} />
        </div>
      </div>
      {(o.message || o.response_message) && (
        <div className="flex flex-col gap-2 border-t px-5 py-4 text-sm">
          {o.message && <p className="leading-relaxed"><span className="text-muted-foreground">{tab === "received" ? "Buyer" : "You"}:</span> {o.message}</p>}
          {o.response_message && <p className="leading-relaxed"><span className="text-muted-foreground">{tab === "received" ? "You" : "Grower"}:</span> {o.response_message}</p>}
        </div>
      )}
      {o.status === "pending" && (
        <div className="bg-surface-2/40 border-t px-5 py-4">
          {tab === "received" ? (
            <>
              {replying && <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Optional note, e.g. pickup details or why you're declining" rows={2} className="mb-3" />}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={!!busy} onClick={() => act("accept")}>{busy === "accept" ? <Loader2 className="animate-spin" /> : <Check />} Accept & open order</Button>
                <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act("reject")}>{busy === "reject" ? <Loader2 className="animate-spin" /> : <X />} Decline</Button>
                {!replying && <Button size="sm" variant="ghost" onClick={() => setReplying(true)}>Add a note</Button>}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground text-xs">{o.expires_at ? `Expires ${timeAgo(o.expires_at).replace(" ago", "")}` : ""}</span>
              <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act("withdraw")}>{busy && <Loader2 className="animate-spin" />} Withdraw</Button>
            </div>
          )}
        </div>
      )}
    </article>
  )
}
