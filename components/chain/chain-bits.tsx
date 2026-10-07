"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowLeftRight, BadgeCheck, CircleDollarSign, ExternalLink, Gavel, Hammer, ShoppingCart, Sparkles } from "lucide-react"
import { ZeroAddress } from "ethers"
import { CHAIN_LABELS } from "@/lib/abi"
import { ETH_USD, explorerAddress, explorerTx } from "@/lib/config"
import { formatUSD, shortAddress, shortHash, timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { ChainEvent } from "@/lib/types/chain"

const ICONS: Record<string, ReactNode> = {
  CropCertificateCreated: <Sparkles />,
  AuctionCreated: <Gavel />,
  BidPlaced: <Hammer />,
  AuctionFinalized: <BadgeCheck />,
  DirectPurchase: <ShoppingCart />,
  CropSold: <CircleDollarSign />,
  Transfer: <ArrowLeftRight />,
}

const TONES: Record<string, string> = {
  CropCertificateCreated: "text-gold bg-gold-soft border-gold/25",
  AuctionCreated: "text-live bg-live-soft border-live/25",
  BidPlaced: "text-live bg-live-soft border-live/25",
  AuctionFinalized: "text-signal bg-signal-soft border-signal/25",
  DirectPurchase: "text-signal bg-signal-soft border-signal/25",
  CropSold: "text-signal bg-signal-soft border-signal/25",
  Transfer: "text-muted-foreground bg-muted border-border",
}

export function EventBadge({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-medium whitespace-nowrap [&_svg]:size-3.5", TONES[name] ?? TONES.Transfer, className)}>
      {ICONS[name]}
      {CHAIN_LABELS[name] ?? name}
    </span>
  )
}

/** On-chain value: ETH first (the truth), USD at the configured rate second. */
export function EthValue({ eth, className }: { eth?: string | null; className?: string }) {
  if (eth == null) return <span className="text-muted-foreground">—</span>
  const n = Number(eth)
  return (
    <span className={cn("tabular flex flex-col", className)}>
      <span className="font-mono text-[13px]">{n < 0.0001 && n > 0 ? n.toExponential(2) : n.toFixed(n < 1 ? 5 : 3)} ETH</span>
      <span className="text-muted-foreground text-[11px]">≈ {formatUSD(n * ETH_USD)}</span>
    </span>
  )
}

export function AddressLink({ address, className }: { address?: string | null; className?: string }) {
  if (!address) return <span className="text-muted-foreground">—</span>
  if (address === ZeroAddress) return <span className={cn("text-muted-foreground font-mono text-[12.5px]", className)}>0x0 (mint)</span>
  const href = explorerAddress(address)
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={cn("font-mono text-[12.5px] underline decoration-border-strong underline-offset-4 hover:decoration-foreground", className)}>
      {shortAddress(address)}
    </a>
  ) : (
    <span className={cn("font-mono text-[12.5px]", className)} title={address}>{shortAddress(address)}</span>
  )
}

/** Internal tx inspector link, with a small Etherscan hop when an explorer exists. */
export function TxLink({ hash, className }: { hash: string; className?: string }) {
  const ext = explorerTx(hash)
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <Link href={`/chain/tx/${hash}`} className="font-mono text-[12.5px] underline decoration-border-strong underline-offset-4 hover:decoration-foreground">
        {shortHash(hash, 5)}
      </Link>
      {ext && (
        <a href={ext} target="_blank" rel="noreferrer" aria-label="View on Etherscan" className="text-muted-foreground hover:text-foreground">
          <ExternalLink className="size-3" />
        </a>
      )}
    </span>
  )
}

export function TokenLink({ id }: { id: number | null }) {
  if (id == null) return null
  return (
    <Link href={`/token/${id}`} className="text-gold font-mono text-[12.5px] underline decoration-gold/40 underline-offset-4">
      #{id}
    </Link>
  )
}

/** One-line plain-English reading of an event. */
export function EventSentence({ e }: { e: ChainEvent }) {
  const a = e.args as Record<string, string>
  const lot = e.lot ? (
    <Link href={`/crop/${e.lot.id}`} className="hover:underline">{e.lot.title}</Link>
  ) : null
  switch (e.name) {
    case "CropCertificateCreated":
      return <span>Certificate <TokenLink id={e.tokenId} /> minted to <AddressLink address={a.farmer} /> · {lot ?? <span className="text-muted-foreground">{a.title}</span>}</span>
    case "AuctionCreated":
      return <span>Auction <span className="font-mono">#{e.auctionId}</span> opened for <TokenLink id={e.tokenId} />{lot && <> · {lot}</>}</span>
    case "BidPlaced":
      return <span><AddressLink address={a.bidder} /> bid on auction <span className="font-mono">#{e.auctionId}</span> (<TokenLink id={e.tokenId} />)</span>
    case "AuctionFinalized":
      return a.winner === ZeroAddress
        ? <span>Auction <span className="font-mono">#{e.auctionId}</span> closed without a sale; bidder refunded</span>
        : <span>Auction <span className="font-mono">#{e.auctionId}</span> won by <AddressLink address={a.winner} /></span>
    case "DirectPurchase":
      return <span><AddressLink address={a.buyer} /> bought <TokenLink id={e.tokenId} /> outright{lot && <> · {lot}</>}</span>
    case "CropSold":
      return <span><TokenLink id={e.tokenId} /> sold to <AddressLink address={a.buyer} />{lot && <> · {lot}</>}</span>
    case "Transfer":
      return a.from === ZeroAddress
        ? <span>NFT <TokenLink id={e.tokenId} /> created → <AddressLink address={a.to} /></span>
        : <span>NFT <TokenLink id={e.tokenId} />: <AddressLink address={a.from} /> → <AddressLink address={a.to} /></span>
    default:
      return <span>{e.name}</span>
  }
}

export function When({ ts }: { ts?: number | null }) {
  if (!ts) return <span className="text-muted-foreground">—</span>
  const iso = new Date(ts * 1000).toISOString()
  return <span title={new Date(ts * 1000).toLocaleString()} suppressHydrationWarning>{timeAgo(iso)}</span>
}

/** Pretty JSON with a light syntax tint, for metadata and decoded args. */
export function JsonView({ value, className }: { value: unknown; className?: string }) {
  const json = JSON.stringify(value, null, 2) ?? "null"
  const html = json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/("(?:\\.|[^"\\])*")(\s*:)?/g, (_m, str, colon) => (colon ? `<span class="text-gold">${str}</span>${colon}` : `<span class="text-signal">${str}</span>`))
    .replace(/\b(true|false|null)\b/g, '<span class="text-live">$1</span>')
  return <pre className={cn("bg-surface-2/60 overflow-auto rounded-2xl border p-4 font-mono text-[12px] leading-relaxed", className)} dangerouslySetInnerHTML={{ __html: html }} />
}
