"use client"

import Link from "next/link"
import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Check, CircleDollarSign, Loader2, Package, PackageCheck, Truck, X } from "lucide-react"
import { toast } from "sonner"
import { AuthGate } from "@/components/auth-gate"
import { CropMedia } from "@/components/crop-art"
import { Empty, OrderStatusPill, PageHeader, Skeleton, TxHash } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api, errorMessage, useApi } from "@/lib/api"
import { useWallet } from "@/lib/wallet/wallet-provider"
import { displayName, formatDate, formatEth, formatQty, formatUSD } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Order } from "@/lib/types/database"

const SOURCE = { buy_now: "Buy now", offer: "Accepted offer", auction: "Auction win" }

export default function OrdersPage() {
  return (
    <AuthGate>
      <Suspense>
        <Orders />
      </Suspense>
    </AuthGate>
  )
}

function Orders() {
  const { user } = useWallet()
  const params = useSearchParams()
  const router = useRouter()
  const tab = (params.get("tab") ?? (user?.role === "farmer" ? "sales" : "purchases")) as "purchases" | "sales"
  const { data, isLoading, mutate } = useApi<Order[]>(`/api/orders?as=${tab === "sales" ? "farmer" : "buyer"}`)

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        title={<><span className="italic">Orders</span></>}
        description={tab === "sales" ? "Lots you've sold. Confirm payment, ship, and the buyer closes the loop on delivery." : "Lots you've bought. Pay the grower, then confirm when it arrives."}
        actions={
          <Tabs value={tab} onValueChange={(v) => router.replace(`/orders?tab=${v}`)}>
            <TabsList>
              <TabsTrigger value="purchases">Purchases</TabsTrigger>
              <TabsTrigger value="sales">Sales</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      {isLoading ? (
        <Skeleton className="h-60" />
      ) : !data?.length ? (
        <Empty
          icon={<Package />}
          title={tab === "sales" ? "No sales yet" : "No purchases yet"}
          description={tab === "sales" ? "Orders appear here when a buyer uses buy-now, you accept an offer, or an auction closes above reserve." : "Buy a lot outright, win an auction or get an offer accepted to see it here."}
          action={<Button asChild variant="outline"><Link href="/marketplace">Go to the market</Link></Button>}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {data.map((o) => <OrderCard key={o.id} order={o} side={tab === "sales" ? "farmer" : "buyer"} onChange={mutate} />)}
        </div>
      )}
    </div>
  )
}

const STAGES = ["Ordered", "Paid", "Shipped", "Delivered"]

function stageIndex(o: Order) {
  if (o.delivery_status === "delivered") return 3
  if (o.delivery_status === "shipped") return 2
  if (o.payment_status === "paid") return 1
  return 0
}

function OrderCard({ order: o, side, onChange }: { order: Order; side: "farmer" | "buyer"; onChange: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const cancelled = o.delivery_status === "cancelled"
  const stage = stageIndex(o)
  const counterparty = side === "farmer" ? o.buyer : o.farmer

  const act = async (action: "confirm_payment" | "ship" | "deliver" | "cancel", msg: string) => {
    setBusy(action)
    try {
      await api(`/api/orders/${o.id}`, { method: "PATCH", json: { action } })
      toast.success(msg)
      onChange()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const next =
    side === "farmer"
      ? o.payment_status === "pending" && o.delivery_status === "pending"
        ? { action: "confirm_payment" as const, label: "Payment received", icon: <CircleDollarSign />, msg: "Payment confirmed" }
        : o.payment_status === "paid" && o.delivery_status === "pending"
          ? { action: "ship" as const, label: "Mark shipped", icon: <Truck />, msg: "Marked as shipped. The buyer has been notified" }
          : null
      : o.delivery_status === "shipped"
        ? { action: "deliver" as const, label: "Confirm delivery", icon: <PackageCheck />, msg: "Delivery confirmed. Order complete" }
        : null
  const canCancel = !cancelled && o.payment_status !== "paid" && o.delivery_status === "pending"

  return (
    <article className={cn("panel overflow-hidden", cancelled && "opacity-70")}>
      <div className="grid gap-5 p-5 sm:grid-cols-[72px_1fr_auto] sm:items-center">
        {o.crop && <Link href={`/crop/${o.crop.id}`} className="hidden size-[72px] overflow-hidden rounded-2xl sm:block"><CropMedia crop={o.crop} /></Link>}
        <div className="min-w-0">
          <Link href={o.crop ? `/crop/${o.crop.id}` : "#"} className="font-display line-clamp-1 text-[1.45rem] leading-tight hover:underline">{o.crop?.title ?? "Lot"}</Link>
          <div className="text-muted-foreground mt-1 text-[13px]">
            {SOURCE[o.source]} · {side === "farmer" ? "to" : "from"} {displayName(counterparty)} · {formatDate(o.created_at)}
          </div>
        </div>
        <div className="flex items-center gap-5 sm:justify-end">
          <div className="text-right">
            <div className="tabular text-xl font-medium">{formatUSD(o.total_amount)}</div>
            <div className="text-muted-foreground tabular text-xs">{formatQty(o.quantity)} {o.crop?.unit} · ≈ {formatEth(o.total_amount)}</div>
          </div>
          <OrderStatusPill payment={o.payment_status} delivery={o.delivery_status} />
        </div>
      </div>

      {!cancelled && (
        <div className="border-t px-5 py-4">
          <ol className="grid grid-cols-4 gap-2" aria-label="Order progress">
            {STAGES.map((s, i) => (
              <li key={s} className="flex flex-col gap-2">
                <span className={cn("h-1 rounded-full", i <= stage ? "bg-signal" : "bg-border-strong")} />
                <span className={cn("flex items-center gap-1 text-xs", i <= stage ? "text-foreground" : "text-muted-foreground")}>
                  {i <= stage && <Check className="text-signal size-3" />} {s}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {(next || canCancel || o.transaction_hash) && (
        <div className="bg-surface-2/40 flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3.5">
          <div className="text-muted-foreground text-xs">
            {o.transaction_hash ? <span className="flex items-center gap-2">Settled on-chain <TxHash value={o.transaction_hash} /></span> : side === "buyer" && o.payment_status === "pending" ? "Pay the grower directly; they'll confirm here once it arrives." : null}
          </div>
          <div className="flex gap-2">
            {canCancel && (
              <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => act("cancel", "Order cancelled, lot returned to market")}>
                {busy === "cancel" ? <Loader2 className="animate-spin" /> : <X />} Cancel
              </Button>
            )}
            {next && (
              <Button size="sm" disabled={!!busy} onClick={() => act(next.action, next.msg)}>
                {busy === next.action ? <Loader2 className="animate-spin" /> : next.icon} {next.label}
              </Button>
            )}
          </div>
        </div>
      )}
    </article>
  )
}
