"use client"

import { useEffect, useState } from "react"
import { Eye, EyeOff, Loader2, ShoppingBasket, Tractor } from "lucide-react"
import { toast } from "sonner"
import { AuthGate } from "@/components/auth-gate"
import { Address, PageHeader } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { errorMessage } from "@/lib/api"
import { useWallet } from "@/lib/wallet/wallet-provider"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/lib/types/database"

export default function SettingsPage() {
  return (
    <AuthGate>
      <Settings />
    </AuthGate>
  )
}

function Settings() {
  const { user, updateProfile, kind, walletName, burnerPrivateKey } = useWallet()
  const [form, setForm] = useState({ display_name: "", location: "", bio: "" })
  const [role, setRole] = useState<UserRole>("buyer")
  const [saving, setSaving] = useState(false)
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    if (!user) return
    setForm({ display_name: user.display_name ?? "", location: user.location ?? "", bio: user.bio ?? "" })
    setRole(user.role)
  }, [user])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateProfile({ ...form, role })
      toast.success("Profile saved")
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader title={<>Profile</>} description="How you appear to counterparties. Your wallet address is your identity; everything here is optional." />
      <form onSubmit={save} className="panel flex flex-col gap-6 p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <Label>I'm mainly here to…</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["buyer", "farmer"] as const).map((r) => (
              <button
                type="button"
                key={r}
                onClick={() => setRole(r)}
                aria-pressed={role === r}
                className={cn("flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors", role === r ? "border-signal bg-signal-soft" : "hover:bg-accent/40")}
              >
                {r === "farmer" ? <Tractor className="mt-0.5 size-5" /> : <ShoppingBasket className="mt-0.5 size-5" />}
                <span>
                  <span className="block font-medium">{r === "farmer" ? "Sell what I grow" : "Buy produce"}</span>
                  <span className="text-muted-foreground text-sm">{r === "farmer" ? "List lots, auction, accept offers" : "Bid, make offers, track orders"}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Display name</Label>
            <Input id="name" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder={role === "farmer" ? "e.g. Harjit Singh Farms" : "e.g. Deccan Foods"} maxLength={60} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="loc">Location</Label>
            <Input id="loc" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="District, region" maxLength={80} />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bio">About</Label>
          <Textarea id="bio" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} maxLength={400} placeholder={role === "farmer" ? "Acreage, practices, certifications…" : "What you buy and how much"} />
        </div>
        <div className="flex justify-end border-t pt-6">
          <Button type="submit" disabled={saving}>{saving && <Loader2 className="animate-spin" />} Save profile</Button>
        </div>
      </form>

      <section className="panel-flat mt-6 divide-y text-sm">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <span className="text-muted-foreground">Wallet</span>
          <span className="flex items-center gap-2"><span className="text-muted-foreground">{walletName}</span> <Address value={user.wallet_address} /></span>
        </div>
        {kind === "burner" && (
          <div className="px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Burner private key</span>
              <Button size="sm" variant="ghost" onClick={() => setShowKey((s) => !s)}>{showKey ? <EyeOff /> : <Eye />} {showKey ? "Hide" : "Reveal"}</Button>
            </div>
            {showKey && <p className="bg-surface-2 mt-3 rounded-xl border p-3 font-mono text-xs break-all">{burnerPrivateKey()}</p>}
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">This key lives only in this browser. Clearing site data loses it. Import it into a real wallet if you want to keep these lots.</p>
          </div>
        )}
      </section>
    </div>
  )
}
