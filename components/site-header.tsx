"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import {
  Award, Bell, Blocks, ChevronDown, Copy, LayoutDashboard, LogOut, Menu, Moon, Package, Settings, ShieldCheck, Sprout, Sun, Tractor, ShoppingBasket,
} from "lucide-react"
import { toast } from "sonner"
import { Logo } from "@/components/logo"
import { Avatar, Pill } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useWallet } from "@/lib/wallet/wallet-provider"
import { api, useApi } from "@/lib/api"
import { displayName, shortAddress, timeAgo } from "@/lib/format"
import { chainConfig, SEPOLIA_FAUCETS } from "@/lib/config"
import { cn } from "@/lib/utils"
import type { Notification } from "@/lib/types/database"

const PUBLIC_LINKS = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/auctions", label: "Auctions" },
  { href: "/chain", label: "Ledger" },
  { href: "/verify", label: "Verify" },
]
const FARMER_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/my-crops", label: "My lots" },
  { href: "/offers", label: "Offers" },
  { href: "/orders?tab=sales", label: "Sales" },
]
const BUYER_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/my-bids", label: "My bids" },
  { href: "/offers?tab=sent", label: "My offers" },
  { href: "/orders", label: "Orders" },
]

export function SiteHeader() {
  const { user, status, setConnectOpen } = useWallet()
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const isActive = (href: string) => {
    const path = href.split("?")[0]
    return pathname === path || (path !== "/" && pathname.startsWith(`${path}/`))
  }

  return (
    <header className={cn("sticky top-0 z-50 transition-[background-color,border-color] duration-300", scrolled ? "glass border-b" : "border-b border-transparent")}>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {PUBLIC_LINKS.map((l) => (
            <NavLink key={l.href} href={l.href} active={isActive(l.href)}>
              {l.label}
            </NavLink>
          ))}
          {user && <span className="bg-border mx-2 h-4 w-px" />}
          {user &&
            (user.role === "farmer" ? FARMER_LINKS : BUYER_LINKS).map((l) => (
              <NavLink key={l.href} href={l.href} active={isActive(l.href)}>
                {l.label}
              </NavLink>
            ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user?.role === "farmer" && (
            <Button asChild size="sm" className="hidden md:inline-flex">
              <Link href="/register-crop">
                <Sprout /> List a lot
              </Link>
            </Button>
          )}
          <ThemeToggle />
          {user && <NotificationBell />}
          {user ? (
            <AccountMenu />
          ) : (
            <Button size="sm" onClick={() => setConnectOpen(true)} disabled={status === "restoring"} className="min-w-[124px]">
              {status === "restoring" ? "…" : "Connect wallet"}
            </Button>
          )}
          <MobileNav />
        </div>
      </div>
    </header>
  )
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative rounded-full px-3 py-1.5 text-[13.5px] transition-colors",
        active ? "text-foreground bg-accent" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const dark = mounted ? resolvedTheme === "dark" : true
  return (
    <Button variant="ghost" size="icon-sm" onClick={() => setTheme(dark ? "light" : "dark")} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>
      {dark ? <Sun /> : <Moon />}
    </Button>
  )
}

function NotificationBell() {
  const { data, mutate } = useApi<Notification[]>("/api/notifications", { refreshInterval: 20_000 })
  const router = useRouter()
  const unread = data?.filter((n) => !n.read).length ?? 0

  const markAll = async () => {
    await api("/api/notifications", { method: "PATCH", json: {} })
    mutate()
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label={unread ? `${unread} unread notifications` : "Notifications"}>
          <Bell />
          {unread > 0 && (
            <span className="bg-live text-[oklch(0.2_0.05_50)] absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold tabular">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] rounded-2xl p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="font-medium">Notifications</span>
          {unread > 0 && (
            <button onClick={markAll} className="text-muted-foreground hover:text-foreground text-xs">
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {!data?.length ? (
            <p className="text-muted-foreground px-4 py-10 text-center text-sm">Nothing yet. Bids, offers and orders will show up here.</p>
          ) : (
            data.map((n) => (
              <button
                key={n.id}
                onClick={async () => {
                  if (!n.read) api("/api/notifications", { method: "PATCH", json: { ids: [n.id] } }).then(() => mutate())
                  if (n.link) router.push(n.link)
                }}
                className="hover:bg-accent/60 flex w-full gap-3 border-b px-4 py-3 text-left transition-colors last:border-0"
              >
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-live")} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{n.title}</span>
                  <span className="text-muted-foreground line-clamp-2 block text-[13px] leading-snug">{n.message}</span>
                  <span className="text-muted-foreground/80 mt-1 block text-[11px]">{timeAgo(n.created_at)}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function AccountMenu() {
  const { user, walletName, disconnect, setRole } = useWallet()
  const router = useRouter()
  const { data: bal } = useApi<{ eth: string; nfts: number }>(user ? `/api/chain/balance?address=${user.wallet_address}` : null, { refreshInterval: 15_000 })
  if (!user) return null
  const empty = bal && Number(bal.eth) === 0
  const switchRole = async (role: "farmer" | "buyer") => {
    if (role === user.role) return
    await setRole(role)
    router.push("/dashboard")
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="hover:bg-accent flex items-center gap-2 rounded-full border py-1 pr-2.5 pl-1 transition-colors" aria-label="Account menu">
          <Avatar address={user.wallet_address} name={user.display_name} className="size-7 text-[10px]" />
          <span className="hidden text-[13px] font-medium sm:block">{displayName(user)}</span>
          <ChevronDown className="text-muted-foreground size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 rounded-2xl p-1.5">
        <DropdownMenuLabel className="flex items-center gap-3 px-2.5 py-2.5 font-normal">
          <Avatar address={user.wallet_address} name={user.display_name} />
          <div className="min-w-0">
            <div className="truncate font-medium">{user.display_name || "Unnamed account"}</div>
            <div className="text-muted-foreground font-mono text-xs">{shortAddress(user.wallet_address)} · {walletName}</div>
          </div>
        </DropdownMenuLabel>
        <div className="mx-1.5 mb-2 flex items-center justify-between rounded-xl border px-3 py-2 text-xs">
          <span className="text-muted-foreground flex items-center gap-1.5"><span className="bg-signal size-1.5 rounded-full" />{chainConfig.name}</span>
          <span className="tabular font-mono">{bal ? `${Number(bal.eth).toFixed(4)} ETH` : "…"}{bal && chainConfig.enabled ? ` · ${bal.nfts} NFT${bal.nfts === 1 ? "" : "s"}` : ""}</span>
        </div>
        {empty && chainConfig.isTestnet && (
          <div className="bg-live-soft text-live mx-1.5 mb-2 rounded-xl border border-live/25 px-3 py-2 text-xs leading-relaxed">
            This wallet has no Sepolia ETH. Copy the address and use a faucet:{" "}
            {SEPOLIA_FAUCETS.slice(0, 2).map((f, i) => (
              <a key={f.url} href={f.url} target="_blank" rel="noreferrer" className="underline">{i ? ", " : ""}{f.name}</a>
            ))}
          </div>
        )}
        <div className="px-1.5 pb-1.5">
          <div className="bg-surface-2/70 grid grid-cols-2 gap-1 rounded-full border p-1" role="radiogroup" aria-label="Role">
            {(["buyer", "farmer"] as const).map((r) => (
              <button
                key={r}
                role="radio"
                aria-checked={user.role === r}
                onClick={() => switchRole(r)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-full py-1.5 text-[13px] transition-colors",
                  user.role === r ? "bg-card text-foreground border shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r === "farmer" ? <Tractor className="size-3.5" /> : <ShoppingBasket className="size-3.5" />}
                {r === "farmer" ? "Farmer" : "Buyer"}
              </button>
            ))}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/dashboard")}><LayoutDashboard /> Dashboard</DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(user.role === "farmer" ? "/orders?tab=sales" : "/orders")}><Package /> Orders</DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/certificates")}><Award /> My certificates (NFTs)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/chain")}><Blocks /> On-chain ledger</DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/settings")}><Settings /> Profile & settings</DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/status")}><ShieldCheck /> Network status</DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            navigator.clipboard?.writeText(user.wallet_address)
            toast.success("Address copied")
          }}
        >
          <Copy /> Copy address
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={async () => {
            await disconnect()
            router.push("/")
          }}
        >
          <LogOut /> Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MobileNav() {
  const { user } = useWallet()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [pathname])
  const links = [...PUBLIC_LINKS, ...(user ? (user.role === "farmer" ? [...FARMER_LINKS, { href: "/register-crop", label: "List a lot" }] : BUYER_LINKS) : [])]
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="bg-background w-[86vw] max-w-sm border-l p-6">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <Logo />
        {user && (
          <Pill tone={user.role === "farmer" ? "gold" : "signal"} className="mt-5">
            {user.role === "farmer" ? "Farmer mode" : "Buyer mode"}
          </Pill>
        )}
        <nav className="mt-6 flex flex-col">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="font-display border-b py-3.5 text-2xl">
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="text-muted-foreground mt-8 text-xs">
          {chainConfig.enabled ? `Certificates settle on ${chainConfig.name}.` : "Running in off-chain mode."}
        </p>
      </SheetContent>
    </Sheet>
  )
}
