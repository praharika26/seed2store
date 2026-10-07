"use client"

import Link from "next/link"
import { ArrowRight, ArrowUpRight, Bell, CircleDollarSign, Gavel, MessageSquareText, Sprout, Truck } from "lucide-react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { AuthGate } from "@/components/auth-gate"
import { Empty, PageHeader, Skeleton } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { useApi } from "@/lib/api"
import { useWallet } from "@/lib/wallet/wallet-provider"
import { cropTypeInfo } from "@/lib/crops"
import { displayName, formatCompactUSD, formatUSD, timeAgo } from "@/lib/format"
import type { BuyerStats, FarmerStats, Notification, Offer, Order, SeriesPoint } from "@/lib/types/database"

export default function DashboardPage() {
  return (
    <AuthGate>
      <Dashboard />
    </AuthGate>
  )
}

function Dashboard() {
  const { user } = useWallet()
  const farmer = user?.role === "farmer"
  const { data: stats } = useApi<FarmerStats | BuyerStats>("/api/stats")
  const { data: orders } = useApi<Order[]>(`/api/orders?as=${farmer ? "farmer" : "buyer"}`)
  const { data: offers } = useApi<Offer[]>(`/api/offers?type=${farmer ? "received" : "sent"}`)
  const { data: notes } = useApi<Notification[]>("/api/notifications")

  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening"

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        title={<>{greeting}, <span className="italic">{user?.display_name?.split(" ")[0] ?? (farmer ? "grower" : "buyer")}</span></>}
        description={farmer ? "Your lots, offers and sales at a glance." : "Your bids, offers and orders at a glance."}
        actions={
          farmer ? (
            <Button asChild><Link href="/register-crop"><Sprout /> List a lot</Link></Button>
          ) : (
            <Button asChild><Link href="/marketplace">Browse the market <ArrowRight /></Link></Button>
          )
        }
      />

      {!user?.display_name && (
        <Link href="/settings" className="bg-gold-soft hover:border-gold/40 mb-8 flex items-center justify-between gap-4 rounded-2xl border border-gold/25 px-5 py-4 transition-colors">
          <span className="text-sm"><span className="font-medium">Add your name and location.</span> <span className="text-muted-foreground">Counterparties trust a named {farmer ? "grower" : "buyer"} over a wallet address.</span></span>
          <ArrowUpRight className="size-4 shrink-0" />
        </Link>
      )}

      {!stats ? (
        <Skeleton className="h-[120px]" />
      ) : stats.role === "farmer" ? (
        <Ledger
          items={[
            ["Settled revenue", formatUSD(stats.revenue.settled), `${formatUSD(stats.revenue.pending)} awaiting payment`],
            ["Lots on market", String(stats.lots.active + stats.lots.auction), `${stats.lots.sold} sold · ${stats.lots.total} total`],
            ["Live auctions", String(stats.auctions.live), `${stats.auctions.total} run to date`],
            ["Open offers", String(stats.offers.pending), `${stats.offers.accepted} accepted`],
          ]}
        />
      ) : (
        <Ledger
          items={[
            ["Settled spend", formatUSD(stats.spending.settled), `${formatUSD(stats.spending.pending)} awaiting payment`],
            ["Bids leading", String(stats.bids.winning), `${stats.bids.won} auctions won`],
            ["Offers pending", String(stats.offers.pending), `${stats.offers.accepted} accepted`],
            ["Orders in transit", String(stats.orders.in_transit), `${stats.orders.delivered} delivered`],
          ]}
        />
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="panel p-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-2xl">{farmer ? "Revenue" : "Spend"}, last 30 days</h2>
            <span className="text-muted-foreground text-xs">Cumulative · settled orders</span>
          </div>
          {stats ? <Chart series={stats.role === "farmer" ? stats.revenue.series : stats.spending.series} /> : <Skeleton className="mt-6 h-[240px]" />}
          {stats?.role === "farmer" && stats.by_crop.length > 0 && (
            <div className="mt-6 border-t pt-5">
              <div className="text-muted-foreground mb-3 text-xs">Sales by crop</div>
              <div className="flex h-2.5 overflow-hidden rounded-full">
                {stats.by_crop.map((c, i) => (
                  <div key={c.crop_type} style={{ flexGrow: c.value, background: `var(--chart-${(i % 5) + 1})` }} title={`${cropTypeInfo(c.crop_type).label}: ${formatUSD(c.value)}`} />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
                {stats.by_crop.map((c, i) => (
                  <span key={c.crop_type} className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: `var(--chart-${(i % 5) + 1})` }} />
                    {cropTypeInfo(c.crop_type).label} <span className="text-muted-foreground tabular">{formatCompactUSD(c.value)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="panel flex flex-col p-6">
          <h2 className="font-display text-2xl">Needs your attention</h2>
          <TodoList farmer={farmer} orders={orders} offers={offers} />
        </section>
      </div>

      <section className="mt-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-2xl">Recent activity</h2>
        </div>
        {!notes ? (
          <Skeleton className="h-40" />
        ) : notes.length === 0 ? (
          <Empty icon={<Bell />} title="Quiet so far" description={farmer ? "When buyers bid or make offers on your lots, you'll see it here." : "Bids, offers and order updates will show up here."} />
        ) : (
          <div className="panel-flat divide-y">
            {notes.slice(0, 8).map((n) => (
              <Link key={n.id} href={n.link ?? "#"} className="hover:bg-accent/40 flex items-center gap-4 px-5 py-4 transition-colors">
                <span className={`size-2 shrink-0 rounded-full ${n.read ? "bg-border-strong" : "bg-live"}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{n.title}</div>
                  <div className="text-muted-foreground truncate text-[13px]">{n.message}</div>
                </div>
                <span className="text-muted-foreground shrink-0 text-xs">{timeAgo(n.created_at)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Ledger({ items }: { items: [string, string, string][] }) {
  return (
    <div className="panel grid grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value, sub], i) => (
        <div key={label} className={`p-5 sm:p-6 ${i % 2 ? "border-l" : ""} ${i >= 2 ? "border-t lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""}`}>
          <div className="text-muted-foreground text-[12.5px]">{label}</div>
          <div className="tabular mt-1.5 text-[1.9rem] leading-none font-medium tracking-tight">{value}</div>
          <div className="text-muted-foreground mt-2 text-xs">{sub}</div>
        </div>
      ))}
    </div>
  )
}

function Chart({ series }: { series: SeriesPoint[] }) {
  const empty = series.every((p) => p.value === 0)
  return (
    <div className="relative mt-6 h-[240px]">
      {empty && <p className="text-muted-foreground absolute inset-0 z-10 grid place-items-center text-sm">No settled orders in the last 30 days.</p>}
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickFormatter={(d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })} minTickGap={40} />
          <YAxis tickLine={false} axisLine={false} width={52} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickFormatter={(v: number) => formatCompactUSD(v)} />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)" }}
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border-strong)", borderRadius: 12, fontSize: 12 }}
            labelStyle={{ color: "var(--muted-foreground)" }}
            itemStyle={{ color: "var(--foreground)" }}
            formatter={(v: number) => [formatUSD(v), "Total"]}
            labelFormatter={(d: string) => new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric" })}
          />
          <Area type="monotone" dataKey="value" stroke="var(--chart-1)" strokeWidth={2} fill="url(#fill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function TodoList({ farmer, orders, offers }: { farmer: boolean; orders?: Order[]; offers?: Offer[] }) {
  if (!orders || !offers) return <Skeleton className="mt-5 h-40" />
  const items: { icon: React.ReactNode; title: string; sub: string; href: string }[] = []
  if (farmer) {
    offers.filter((o) => o.status === "pending").forEach((o) => items.push({ icon: <MessageSquareText />, title: `Reply to ${displayName(o.buyer)}`, sub: `${formatUSD(o.total_amount)} for ${o.crop?.title}`, href: "/offers" }))
    orders.filter((o) => o.payment_status === "pending" && o.delivery_status === "pending").forEach((o) => items.push({ icon: <CircleDollarSign />, title: "Confirm payment received", sub: `${o.crop?.title} · ${formatUSD(o.total_amount)}`, href: "/orders?tab=sales" }))
    orders.filter((o) => o.payment_status === "paid" && o.delivery_status === "pending").forEach((o) => items.push({ icon: <Truck />, title: "Ship to buyer", sub: `${o.crop?.title} → ${displayName(o.buyer)}`, href: "/orders?tab=sales" }))
  } else {
    orders.filter((o) => o.payment_status === "pending" && o.delivery_status === "pending").forEach((o) => items.push({ icon: <CircleDollarSign />, title: "Pay the grower", sub: `${formatUSD(o.total_amount)} for ${o.crop?.title}`, href: "/orders" }))
    orders.filter((o) => o.delivery_status === "shipped").forEach((o) => items.push({ icon: <Truck />, title: "Confirm delivery", sub: `${o.crop?.title} is in transit`, href: "/orders" }))
    offers.filter((o) => o.status === "accepted").slice(0, 2).forEach((o) => items.push({ icon: <Gavel />, title: "Offer accepted", sub: `${o.crop?.title}: order opened`, href: "/orders" }))
  }

  if (!items.length) {
    return <p className="text-muted-foreground mt-5 flex-1 text-sm leading-relaxed">You&apos;re all caught up. Nothing is waiting on you.</p>
  }
  return (
    <ul className="mt-4 flex flex-col">
      {items.slice(0, 6).map((it, i) => (
        <li key={i}>
          <Link href={it.href} className="group hover:bg-accent/40 -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors">
            <span className="bg-surface-2 text-signal grid size-9 shrink-0 place-items-center rounded-xl border [&_svg]:size-4">{it.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{it.title}</span>
              <span className="text-muted-foreground block truncate text-xs">{it.sub}</span>
            </span>
            <ArrowRight className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
