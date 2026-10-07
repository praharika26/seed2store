"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowRight, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useWallet } from "@/lib/wallet/wallet-provider"
import { cn } from "@/lib/utils"

export function HeroActions() {
  const { user, setConnectOpen, setRole } = useWallet()
  const router = useRouter()

  const listHarvest = async () => {
    if (!user) return setConnectOpen(true)
    if (user.role !== "farmer") await setRole("farmer")
    router.push("/register-crop")
  }

  return (
    <div className="mt-9 flex flex-wrap items-center gap-3">
      <Button asChild size="lg">
        <Link href="/marketplace">
          Browse the market <ArrowRight />
        </Link>
      </Button>
      <Button size="lg" variant="outline" onClick={listHarvest}>
        List your harvest
      </Button>
    </div>
  )
}

export function VerifyForm({ className, defaultValue = "" }: { className?: string; defaultValue?: string }) {
  const [q, setQ] = useState(defaultValue)
  const router = useRouter()
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (q.trim()) router.push(`/verify?q=${encodeURIComponent(q.trim())}`)
      }}
      className={cn("bg-card focus-within:border-ring flex items-center gap-2 rounded-full border p-1.5 pl-5 transition-colors", className)}
    >
      <Search className="text-muted-foreground size-4 shrink-0" />
      <label htmlFor="verify-q" className="sr-only">Certificate serial, token ID or hash</label>
      <input
        id="verify-q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="S2S-7F3A-91C2, token #, or 0x… hash"
        className="placeholder:text-muted-foreground/70 min-w-0 flex-1 bg-transparent py-2 font-mono text-sm outline-none"
        autoComplete="off"
        spellCheck={false}
      />
      <Button type="submit" disabled={!q.trim()}>
        Verify
      </Button>
    </form>
  )
}
