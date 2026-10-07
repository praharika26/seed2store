"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowLeft, ArrowRight, BadgeCheck, Check, Loader2, ScanLine } from "lucide-react"
import { toast } from "sonner"
import { AuthGate } from "@/components/auth-gate"
import { Certificate } from "@/components/certificate"
import { ImageUploader } from "@/components/image-uploader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api, errorMessage } from "@/lib/api"
import { useWallet } from "@/lib/wallet/wallet-provider"
import { useLotActions } from "@/lib/wallet/use-lot-actions"
import { CROP_TYPES, GRADES, UNITS } from "@/lib/crops"
import { chainConfig } from "@/lib/config"
import { DateValidator } from "@/lib/validation/date-validator"
import { formatQty, formatUSD } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Crop } from "@/lib/types/database"

const STEPS = ["The crop", "Origin & quality", "Photos", "Price & quantity"] as const

const empty = {
  title: "", crop_type: "", variety: "", description: "",
  location: "", harvest_date: "", quality_grade: "", moisture_content: "", organic_certified: false, storage_conditions: "",
  quantity: "", unit: "kg", minimum_price: "", starting_price: "", buyout_price: "",
}

export default function RegisterCropPage() {
  return (
    <AuthGate role="farmer" reason="Connect the wallet you farm with. It becomes the owner of every certificate you register.">
      <Register />
    </AuthGate>
  )
}

function Register() {
  const { user } = useWallet()
  const [form, setForm] = useState({ ...empty, location: user?.location ?? "" })
  const [images, setImages] = useState<string[]>([])
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState<Crop | null>(null)
  const [attempted, setAttempted] = useState<boolean[]>([false, false, false, false])
  const set = <K extends keyof typeof empty>(k: K, v: (typeof empty)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const dateCheck = form.harvest_date ? DateValidator.validateHarvestDate(form.harvest_date) : null
  const n = (s: string) => (s === "" ? undefined : Number(s))

  const errors: string[][] = useMemo(() => {
    const e: string[][] = [[], [], [], []]
    if (form.title.trim().length < 3) e[0].push("Give the lot a title (3+ characters).")
    if (!form.crop_type) e[0].push("Choose a crop type.")
    if (form.description.trim().length < 10) e[0].push("Describe the lot in at least a sentence.")
    if (dateCheck && !dateCheck.isValid) e[1].push(dateCheck.error ?? "Invalid harvest date.")
    const m = n(form.moisture_content)
    if (m != null && (m < 0 || m > 100)) e[1].push("Moisture is a percentage between 0 and 100.")
    const q = n(form.quantity), min = n(form.minimum_price), start = n(form.starting_price), buy = n(form.buyout_price)
    if (!q || q <= 0) e[3].push("Enter the quantity you're selling.")
    if (!min || min <= 0) e[3].push("Set a minimum price per unit.")
    if (start != null && min != null && start < min) e[3].push("Asking price can't be below your minimum.")
    if (buy != null && (start ?? min ?? 0) > buy) e[3].push("Buy-now price should be at or above your asking price.")
    return e
  }, [form, dateCheck])

  const preview = {
    title: form.title || "Your lot title",
    crop_type: form.crop_type || "other",
    variety: form.variety || null,
    quantity: Number(form.quantity) || 0,
    unit: form.unit,
    location: form.location || null,
    harvest_date: dateCheck?.isValid ? dateCheck.sanitizedValue : null,
    quality_grade: form.quality_grade || null,
    organic_certified: form.organic_certified,
    content_hash: null,
    nft_minted: false,
    nft_token_id: null,
    created_at: new Date().toISOString(),
  }

  const submit = async () => {
    const firstBad = errors.findIndex((e) => e.length)
    if (firstBad !== -1) {
      setStep(firstBad)
      toast.error(errors[firstBad][0])
      return
    }
    setSubmitting(true)
    try {
      const crop = await api<Crop>("/api/crops", {
        method: "POST",
        json: {
          ...form,
          harvest_date: dateCheck?.sanitizedValue ?? null,
          quantity: n(form.quantity),
          minimum_price: n(form.minimum_price),
          starting_price: n(form.starting_price),
          buyout_price: n(form.buyout_price),
          moisture_content: n(form.moisture_content),
          quality_grade: form.quality_grade || undefined,
          images,
        },
      })
      setCreated(crop)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  if (created) return <Registered crop={created} onMinted={setCreated} />

  const last = step === STEPS.length - 1
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div>
          <h1 className="font-display text-[2.6rem] leading-[1.02] sm:text-[3.4rem]">
            List a <span className="italic">lot</span>
          </h1>
          <p className="text-muted-foreground mt-3 max-w-lg leading-relaxed">
            Fill in what a buyer would ask you on the phone. Provenance fields are fingerprinted when you publish, so get them right; they can&apos;t be edited later.
          </p>

          <ol className="mt-10 flex gap-2" aria-label="Steps">
            {STEPS.map((s, i) => (
              <li key={s} className="flex-1">
                <button type="button" onClick={() => setStep(i)} className="group w-full text-left" aria-current={i === step ? "step" : undefined} aria-label={`Step ${i + 1}: ${s}`}>
                  <span className={cn("block h-1 rounded-full transition-colors", i < step ? "bg-signal" : i === step ? "bg-foreground" : "bg-border-strong")} />
                  <span className={cn("mt-2 hidden items-center gap-1.5 text-xs sm:flex", i === step ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
                    {errors[i].length > 0 && i < step && <span className="bg-live size-1.5 rounded-full" aria-label="Needs attention" />}
                    {s}
                  </span>
                </button>
              </li>
            ))}
          </ol>

          <form
            className="mt-8 flex flex-col gap-6"
            onSubmit={(e) => {
              e.preventDefault()
              setAttempted((a) => a.map((v, i) => (i === step ? true : v)))
              if (last) submit()
              else if (!errors[step].length) setStep(step + 1)
            }}
          >
            {step === 0 && (
              <>
                <Field label="Lot title" htmlFor="title" hint="What a buyer would search for: crop, variety, standout quality.">
                  <Input id="title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Sharbati Wheat, Golden Lot" maxLength={120} autoFocus />
                </Field>
                <div className="grid gap-6 sm:grid-cols-2">
                  <Field label="Crop type" htmlFor="crop_type">
                    <Select value={form.crop_type} onValueChange={(v) => set("crop_type", v)}>
                      <SelectTrigger id="crop_type" className="w-full"><SelectValue placeholder="Choose…" /></SelectTrigger>
                      <SelectContent>{CROP_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Variety" htmlFor="variety" optional>
                    <Input id="variety" value={form.variety} onChange={(e) => set("variety", e.target.value)} placeholder="e.g. Pusa 1121" />
                  </Field>
                </div>
                <Field label="Description" htmlFor="description" hint="Growing practice, processing, taste or test results, what it's best for.">
                  <Textarea id="description" value={form.description} onChange={(e) => set("description", e.target.value)} rows={5} maxLength={4000} />
                </Field>
              </>
            )}

            {step === 1 && (
              <>
                <div className="grid gap-6 sm:grid-cols-2">
                  <Field label="Origin" htmlFor="location" hint="Village, district, region.">
                    <Input id="location" value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Ludhiana, Punjab" />
                  </Field>
                  <Field label="Harvest date" htmlFor="harvest_date" optional error={dateCheck && !dateCheck.isValid ? dateCheck.error : undefined} hint={dateCheck?.warning}>
                    <Input id="harvest_date" type="date" value={form.harvest_date} onChange={(e) => set("harvest_date", e.target.value)} />
                  </Field>
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                  <Field label="Quality grade" htmlFor="grade" optional>
                    <Select value={form.quality_grade} onValueChange={(v) => set("quality_grade", v)}>
                      <SelectTrigger id="grade" className="w-full"><SelectValue placeholder="Ungraded" /></SelectTrigger>
                      <SelectContent>{GRADES.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Moisture content (%)" htmlFor="moisture" optional>
                    <Input id="moisture" type="number" inputMode="decimal" step="0.1" value={form.moisture_content} onChange={(e) => set("moisture_content", e.target.value)} placeholder="e.g. 11.5" />
                  </Field>
                </div>
                <label htmlFor="organic" className="bg-surface-2/50 flex cursor-pointer items-center justify-between gap-4 rounded-2xl border p-4">
                  <span>
                    <span className="block font-medium">Certified organic</span>
                    <span className="text-muted-foreground text-sm">Only if you hold a current certification.</span>
                  </span>
                  <Switch id="organic" checked={form.organic_certified} onCheckedChange={(v) => set("organic_certified", v)} />
                </label>
                <Field label="Storage conditions" htmlFor="storage" optional>
                  <Textarea id="storage" value={form.storage_conditions} onChange={(e) => set("storage_conditions", e.target.value)} rows={2} placeholder="Silo bags at 18–22 °C, fumigation-free…" />
                </Field>
              </>
            )}

            {step === 2 && (
              <Field label="Photos" hint="The first photo is the cover. Lots without photos get a generated field illustration.">
                <ImageUploader value={images} onChange={setImages} />
              </Field>
            )}

            {step === 3 && (
              <>
                <div className="grid gap-6 sm:grid-cols-[1fr_200px]">
                  <Field label="Quantity for sale" htmlFor="quantity">
                    <Input id="quantity" type="number" inputMode="decimal" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} placeholder="e.g. 18" className="tabular" />
                  </Field>
                  <Field label="Unit" htmlFor="unit">
                    <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
                      <SelectTrigger id="unit" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{UNITS.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="grid gap-6 sm:grid-cols-3">
                  <Field label={`Minimum / ${form.unit}`} htmlFor="min" hint="Floor for offers and auctions.">
                    <MoneyInput id="min" value={form.minimum_price} onChange={(v) => set("minimum_price", v)} />
                  </Field>
                  <Field label={`Asking / ${form.unit}`} htmlFor="start" optional hint="Defaults to the minimum.">
                    <MoneyInput id="start" value={form.starting_price} onChange={(v) => set("starting_price", v)} />
                  </Field>
                  <Field label={`Buy now / ${form.unit}`} htmlFor="buy" optional hint="Leave blank for offers only.">
                    <MoneyInput id="buy" value={form.buyout_price} onChange={(v) => set("buyout_price", v)} />
                  </Field>
                </div>
                {Number(form.quantity) > 0 && Number(form.buyout_price || form.starting_price || form.minimum_price) > 0 && (
                  <div className="bg-surface-2/50 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4">
                    <span className="text-muted-foreground text-sm">Whole lot at {form.buyout_price ? "buy-now" : "asking"} price</span>
                    <span className="tabular text-xl font-medium">{formatUSD(Number(form.quantity) * Number(form.buyout_price || form.starting_price || form.minimum_price))}</span>
                  </div>
                )}
              </>
            )}

            {attempted[step] && errors[step].length > 0 && <p className="text-live text-sm" role="alert">{errors[step].join(" ")}</p>}

            <div className="mt-2 flex items-center justify-between border-t pt-6">
              <Button type="button" variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0}>
                <ArrowLeft /> Back
              </Button>
              {last ? (
                <Button type="submit" size="lg" disabled={submitting}>
                  {submitting ? <Loader2 className="animate-spin" /> : <Check />} Publish lot
                </Button>
              ) : (
                <Button type="submit" size="lg">
                  Continue <ArrowRight />
                </Button>
              )}
            </div>
          </form>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-muted-foreground mb-3 text-xs">Live preview</p>
          <Certificate crop={preview} farmer={user ? { ...user, verified: user.verified } : null} />
          <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
            On publish, these fields are fingerprinted with keccak-256 and shown to buyers alongside a verification link.
            {chainConfig.enabled ? ` You can then mint the certificate on ${chainConfig.name}.` : ""}
          </p>
        </aside>
      </div>
    </div>
  )
}

function Field({ label, htmlFor, hint, error, optional, children }: { label: string; htmlFor?: string; hint?: string | null; error?: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor} className="text-[13.5px]">
        {label} {optional && <span className="text-muted-foreground font-normal">optional</span>}
      </Label>
      {children}
      {error ? <p className="text-destructive text-xs">{error}</p> : hint ? <p className="text-muted-foreground text-xs leading-relaxed">{hint}</p> : null}
    </div>
  )
}

function MoneyInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <span className="text-muted-foreground absolute top-1/2 left-3.5 -translate-y-1/2">$</span>
      <Input id={id} type="number" inputMode="decimal" step="0.01" min="0" value={value} onChange={(e) => onChange(e.target.value)} className="tabular pl-7" />
    </div>
  )
}

function Registered({ crop, onMinted }: { crop: Crop; onMinted: (c: Crop) => void }) {
  const { user } = useWallet()
  const { mint, busy } = useLotActions()
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <div className="bg-signal-soft text-signal mb-6 grid size-14 place-items-center rounded-2xl border border-signal/20">
            <Check className="size-7" />
          </div>
          <h1 className="font-display text-[2.8rem] leading-[1.02] sm:text-6xl">
            Your lot is <span className="italic">live.</span>
          </h1>
          <p className="text-muted-foreground mt-4 leading-relaxed">
            {formatQty(crop.quantity)} {crop.unit} of {crop.title} is on the market with certificate fingerprint{" "}
            <span className="text-foreground font-mono text-sm">{crop.content_hash?.slice(0, 12)}…</span>
          </p>

          {chainConfig.enabled && !crop.nft_minted && (
            <div className="bg-gold-soft mt-8 rounded-2xl border border-gold/25 p-5">
              <p className="flex items-center gap-2 font-medium"><ScanLine className="text-gold size-5" /> Certify on {chainConfig.name}</p>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">Minting lets buyers verify your certificate on-chain and pay through contract escrow. Recommended.</p>
              <Button variant="gold" className="mt-4" disabled={busy === "mint"} onClick={async () => { const c = await mint(crop); if (c) onMinted(c) }}>
                {busy === "mint" ? <Loader2 className="animate-spin" /> : <BadgeCheck />} Mint certificate
              </Button>
            </div>
          )}
          {crop.nft_minted && (
            <p className="text-signal mt-6 flex items-center gap-2 text-sm"><BadgeCheck className="size-4" /> Minted on-chain as token #{crop.nft_token_id}</p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link href={`/crop/${crop.id}`}>Open the lot <ArrowRight /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/my-crops">All my lots</Link></Button>
          </div>
        </div>
        <Certificate crop={crop} farmer={user} animate />
      </div>
    </div>
  )
}
