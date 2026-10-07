"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Check, Copy, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatEth, formatUSD, shortAddress, shortHash } from "@/lib/format"
import { explorerAddress, explorerTx } from "@/lib/config"
import type { CropStatus, DeliveryStatus, OfferStatus, PaymentStatus } from "@/lib/types/database"

// ---------------------------------------------------------------------------
// Countdown
// ---------------------------------------------------------------------------

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

export function timeLeftParts(endIso: string, now: number) {
  const ms = Math.max(0, new Date(endIso).getTime() - now)
  const s = Math.floor(ms / 1000)
  return { ms, d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 }
}

export function Countdown({ end, className, compact = false }: { end: string; className?: string; compact?: boolean }) {
  const now = useNow()
  const { ms, d, h, m, s } = timeLeftParts(end, now)
  if (ms <= 0) return <span className={cn("tabular font-mono", className)}>Ended</span>
  const pad = (n: number) => String(n).padStart(2, "0")
  const text = compact
    ? d > 0 ? `${d}d ${pad(h)}h` : h > 0 ? `${h}h ${pad(m)}m` : `${pad(m)}:${pad(s)}`
    : `${d > 0 ? `${d}d ` : ""}${pad(h)}:${pad(m)}:${pad(s)}`
  return (
    <span className={cn("tabular font-mono", ms < 3600_000 && "text-live", className)} suppressHydrationWarning>
      {text}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Price
// ---------------------------------------------------------------------------

export function Price({ usd, unit, className, size = "md", showEth = true }: { usd?: number | null; unit?: string; className?: string; size?: "sm" | "md" | "lg" | "xl"; showEth?: boolean }) {
  const sizes = { sm: "text-base", md: "text-xl", lg: "text-3xl", xl: "text-[2.75rem] leading-none" }
  return (
    <div className={cn("flex flex-col", className)}>
      <span className={cn("tabular font-medium tracking-tight", sizes[size])}>
        {formatUSD(usd, { cents: unit !== undefined && (usd ?? 0) < 100 })}
        {unit && <span className="text-muted-foreground ml-1 text-[0.55em] font-normal">/ {unit}</span>}
      </span>
      {showEth && usd != null && !unit && <span className="text-muted-foreground tabular font-mono text-xs">≈ {formatEth(usd)}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Status pills
// ---------------------------------------------------------------------------

type Tone = "signal" | "live" | "gold" | "muted" | "danger"
const tones: Record<Tone, string> = {
  signal: "bg-signal-soft text-signal border-signal/25",
  live: "bg-live-soft text-live border-live/25",
  gold: "bg-gold-soft text-gold border-gold/25",
  muted: "bg-muted text-muted-foreground border-border",
  danger: "bg-destructive/10 text-destructive border-destructive/25",
}

export function Pill({ tone = "muted", children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-medium tracking-wide whitespace-nowrap", tones[tone], className)}>
      {dot && <span className={cn("size-1.5 rounded-full bg-current", tone === "live" && "live-dot")} />}
      {children}
    </span>
  )
}

export function CropStatusPill({ status }: { status: CropStatus }) {
  const map: Record<CropStatus, [Tone, string]> = {
    active: ["signal", "Listed"],
    auction: ["live", "Live auction"],
    sold: ["gold", "Sold"],
    expired: ["muted", "Withdrawn"],
    draft: ["muted", "Draft"],
  }
  const [tone, label] = map[status]
  return <Pill tone={tone} dot={status === "auction" || status === "active"}>{label}</Pill>
}

export function OfferStatusPill({ status }: { status: OfferStatus }) {
  const map: Record<OfferStatus, [Tone, string]> = {
    pending: ["live", "Awaiting reply"],
    accepted: ["signal", "Accepted"],
    rejected: ["danger", "Declined"],
    withdrawn: ["muted", "Withdrawn"],
    expired: ["muted", "Expired"],
  }
  const [tone, label] = map[status]
  return <Pill tone={tone}>{label}</Pill>
}

export function OrderStatusPill({ payment, delivery }: { payment: PaymentStatus; delivery: DeliveryStatus }) {
  if (delivery === "cancelled") return <Pill tone="danger">Cancelled</Pill>
  if (delivery === "delivered") return <Pill tone="gold">Delivered</Pill>
  if (delivery === "shipped") return <Pill tone="signal" dot>In transit</Pill>
  if (payment === "paid") return <Pill tone="signal">Paid · preparing</Pill>
  return <Pill tone="live">Awaiting payment</Pill>
}

// ---------------------------------------------------------------------------
// Addresses & hashes
// ---------------------------------------------------------------------------

export function CopyValue({ value, display, className, href }: { value: string; display?: string; className?: string; href?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-[12.5px]", className)}>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="hover:text-foreground inline-flex items-center gap-1 underline decoration-border-strong">
          {display ?? value}
          <ExternalLink className="size-3" />
        </a>
      ) : (
        <span>{display ?? value}</span>
      )}
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(value).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1400)
          })
        }}
        className="text-muted-foreground hover:text-foreground rounded p-0.5 transition-colors"
        aria-label={copied ? "Copied" : "Copy to clipboard"}
      >
        {copied ? <Check className="text-signal size-3.5" /> : <Copy className="size-3.5" />}
      </button>
    </span>
  )
}

export function Address({ value, className }: { value: string; className?: string }) {
  return <CopyValue value={value} display={shortAddress(value)} href={explorerAddress(value)} className={className} />
}

export function TxHash({ value, className }: { value: string; className?: string }) {
  return <CopyValue value={value} display={shortHash(value)} href={explorerTx(value)} className={className} />
}

/** Deterministic identicon-ish avatar from an address. */
export function Avatar({ address, name, className }: { address?: string | null; name?: string | null; className?: string }) {
  const a = address ?? "0x0"
  const hue = parseInt(a.slice(2, 6) || "0", 16) % 360
  const hue2 = (hue + 70) % 360
  const initials = (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("")
  return (
    <span
      className={cn("inline-grid size-9 shrink-0 place-items-center rounded-full text-[12px] font-semibold text-white/95 ring-1 ring-black/5", className)}
      style={{ background: `linear-gradient(135deg, oklch(0.62 0.13 ${hue}), oklch(0.42 0.1 ${hue2}))` }}
      aria-hidden="true"
    >
      {initials || a.slice(2, 4).toUpperCase()}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

export function PageHeader({ title, description, actions, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <header className={cn("mb-8 flex flex-col gap-5 sm:mb-10 md:flex-row md:items-end md:justify-between", className)}>
      <div className="max-w-2xl">
        <h1 className="font-display text-[2.6rem] leading-[1.02] sm:text-[3.4rem]">{title}</h1>
        {description && <p className="text-muted-foreground mt-3 text-[15px] leading-relaxed sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  )
}

export function Empty({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("panel-flat flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      {icon && <div className="bg-surface-2 text-muted-foreground mb-5 grid size-14 place-items-center rounded-2xl border [&_svg]:size-6">{icon}</div>}
      <h3 className="font-display text-2xl">{title}</h3>
      {description && <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function Stat({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-muted-foreground text-[12.5px]">{label}</span>
      <span className="tabular text-2xl font-medium tracking-tight">{value}</span>
      {sub && <span className="text-muted-foreground text-xs">{sub}</span>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("bg-muted/70 animate-pulse rounded-xl", className)} />
}
