import Link from "next/link"
import { cn } from "@/lib/utils"

/** Seed-in-seal mark: a sprouting grain inside a certification ring. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="var(--primary)" />
      <circle cx="16" cy="16" r="11.5" fill="none" stroke="var(--primary-foreground)" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="1.6 2.2" />
      <path d="M16 23.5V13.2" stroke="var(--primary-foreground)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 15.6c-3.6-.2-5.6-2.3-5.8-5.6 3.4.1 5.6 2.1 5.8 5.6Z" fill="var(--primary-foreground)" />
      <path d="M16 18.6c3.6-.2 5.6-2.3 5.8-5.6-3.4.1-5.6 2.1-5.8 5.6Z" fill="var(--primary-foreground)" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-2.5 rounded-full", className)} aria-label="Seed2Store home">
      <LogoMark className="transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:rotate-[-12deg]" />
      <span className="font-display text-[1.45rem] leading-none tracking-tight whitespace-nowrap">
        Seed<span className="text-signal mx-[0.04em] italic">2</span>Store
      </span>
    </Link>
  )
}
