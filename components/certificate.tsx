import { certificateSerial } from "@/lib/certificate"
import { cropTypeInfo } from "@/lib/crops"
import { displayName, formatDate, formatQty, shortHash } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Crop, PublicUser } from "@/lib/types/database"

type CertCrop = Pick<Crop, "title" | "crop_type" | "variety" | "quantity" | "unit" | "location" | "harvest_date" | "quality_grade" | "organic_certified" | "content_hash" | "nft_minted" | "nft_token_id" | "created_at">

/** Guilloché-style rosette, drawn as nested rotated ellipses. */
function Rosette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="0.5">
        {Array.from({ length: 24 }).map((_, i) => (
          <ellipse key={i} cx="100" cy="100" rx="92" ry="34" transform={`rotate(${i * 7.5} 100 100)`} />
        ))}
        <circle cx="100" cy="100" r="96" />
        <circle cx="100" cy="100" r="99" strokeDasharray="1 3" />
      </g>
    </svg>
  )
}

/** Wax-seal style mark: rotating text ring around the logo sprout. */
export function Seal({ label, className, animate }: { label: string; className?: string; animate?: boolean }) {
  return (
    <div className={cn("relative size-[92px] -rotate-12", animate && "animate-seal [animation-delay:650ms]", className)}>
      <svg viewBox="0 0 100 100" className="size-full" aria-hidden="true">
        <defs>
          <path id="seal-ring" d="M50,50 m-36,0 a36,36 0 1,1 72,0 a36,36 0 1,1 -72,0" />
        </defs>
        <circle cx="50" cy="50" r="48" fill="var(--gold)" />
        <circle cx="50" cy="50" r="44" fill="none" stroke="oklch(0.25 0.05 80 / 0.5)" strokeWidth="0.6" strokeDasharray="1.5 1.5" />
        <circle cx="50" cy="50" r="27" fill="none" stroke="oklch(0.25 0.05 80 / 0.45)" strokeWidth="0.8" />
        <text fontSize="7.4" letterSpacing="1.6" fill="oklch(0.22 0.05 80)" fontWeight="600">
          <textPath href="#seal-ring">{label}</textPath>
        </text>
        <g transform="translate(50 52)" fill="oklch(0.22 0.05 80)">
          <path d="M0 11V-5" stroke="oklch(0.22 0.05 80)" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M0 -1.5c-5.4-.3-8.4-3.4-8.7-8.4 5.1.2 8.4 3.2 8.7 8.4Z" />
          <path d="M0 3c5.4-.3 8.4-3.4 8.7-8.4-5.1.2-8.4 3.2-8.7 8.4Z" />
        </g>
      </svg>
    </div>
  )
}

export function Certificate({ crop, farmer, className, animate = false }: { crop: CertCrop; farmer?: Pick<PublicUser, "display_name" | "wallet_address" | "verified"> | null; className?: string; animate?: boolean }) {
  const serial = certificateSerial(crop.content_hash)
  const fields: [string, string][] = [
    ["Commodity", [cropTypeInfo(crop.crop_type).label, crop.variety].filter(Boolean).join(" · ")],
    ["Origin", crop.location || "—"],
    ["Harvested", crop.harvest_date ? formatDate(crop.harvest_date) : "—"],
    ["Lot size", `${formatQty(crop.quantity)} ${crop.unit}`],
    ["Grade", crop.quality_grade ? `Grade ${crop.quality_grade}` : "Ungraded"],
    ["Organic", crop.organic_certified ? "Certified" : "Conventional"],
  ]

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-[22px] border border-gold/30 p-6 sm:p-8",
        "bg-[linear-gradient(160deg,color-mix(in_oklch,var(--gold)_9%,var(--card))_0%,var(--card)_55%)]",
        "shadow-[0_30px_70px_-35px_hsl(var(--shadow-color)/0.8)]",
        animate && "animate-reveal",
        className,
      )}
      aria-label={`Certificate of origin ${serial}`}
    >
      <Rosette className="text-gold pointer-events-none absolute -top-24 -right-24 size-[320px] opacity-[0.16]" />
      <div className="pointer-events-none absolute inset-2.5 rounded-[16px] border border-dashed border-gold/25" />

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-gold font-mono text-[11px] tracking-[0.2em] uppercase">Certificate of origin</p>
          <p className="text-muted-foreground mt-1 font-mono text-xs tabular">{serial}</p>
        </div>
        <Seal label={crop.nft_minted ? "· ON-CHAIN · VERIFIED ORIGIN " : "· CONTENT-HASHED · ORIGIN RECORD "} animate={animate} className="-mt-2 -mr-2 shrink-0" />
      </div>

      <h3 className="font-display relative mt-2 text-[2rem] leading-[1.05] sm:text-[2.35rem]">{crop.title}</h3>
      <p className="text-muted-foreground relative mt-2 text-sm">
        Grown by <span className="text-foreground font-medium">{displayName(farmer)}</span>
        {farmer?.verified && <span className="text-signal"> · verified grower</span>}
      </p>

      <dl className="relative mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        {fields.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-muted-foreground text-[11px] tracking-wide uppercase">{k}</dt>
            <dd className="mt-0.5 truncate text-[14.5px]">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="rule relative mt-6" />
      <div className="relative mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 font-mono text-[11.5px]">
        <span className="text-muted-foreground">
          keccak256 <span className="text-foreground">{shortHash(crop.content_hash, 10)}</span>
        </span>
        <span className={crop.nft_minted ? "text-signal" : "text-muted-foreground"}>
          {crop.nft_minted ? `ERC-721 · token #${crop.nft_token_id}` : `Registered ${formatDate(crop.created_at)}`}
        </span>
      </div>
    </article>
  )
}
