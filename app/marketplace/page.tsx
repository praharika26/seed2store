"use client"

import { Suspense, useDeferredValue, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight, Leaf, Search, SearchX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CropCard, CropCardSkeleton } from "@/components/crop-card"
import { Empty, PageHeader } from "@/components/bits"
import { useApi } from "@/lib/api"
import { CROP_TYPES } from "@/lib/crops"
import { cn } from "@/lib/utils"
import type { Crop, PaginatedResponse } from "@/lib/types/database"

const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "ending_soon", label: "Auctions ending soon" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
]
const MODES = [
  { value: "active,auction", label: "All lots" },
  { value: "active", label: "Buy now & offers" },
  { value: "auction", label: "Auctions" },
]

function Marketplace() {
  const params = useSearchParams()
  const router = useRouter()
  const [q, setQ] = useState(params.get("q") ?? "")
  const [type, setType] = useState(params.get("type") ?? "")
  const [organic, setOrganic] = useState(params.get("organic") === "true")
  const [sort, setSort] = useState(params.get("sort") ?? "newest")
  const [mode, setMode] = useState(params.get("mode") ?? "active,auction")
  const [page, setPage] = useState(1)
  const deferredQ = useDeferredValue(q)

  useEffect(() => setPage(1), [deferredQ, type, organic, sort, mode])

  useEffect(() => {
    const sp = new URLSearchParams()
    if (q) sp.set("q", q)
    if (type) sp.set("type", type)
    if (organic) sp.set("organic", "true")
    if (sort !== "newest") sp.set("sort", sort)
    if (mode !== "active,auction") sp.set("mode", mode)
    router.replace(`/marketplace${sp.size ? `?${sp}` : ""}`, { scroll: false })
  }, [q, type, organic, sort, mode, router])

  const query = new URLSearchParams({ page: String(page), limit: "12", sort, status: mode })
  if (deferredQ) query.set("q", deferredQ)
  if (type) query.set("crop_type", type)
  if (organic) query.set("organic", "true")
  const { data, isLoading, error } = useApi<PaginatedResponse<Crop>>(`/api/crops?${query}`, { keepPreviousData: true })

  const clear = () => {
    setQ("")
    setType("")
    setOrganic(false)
    setMode("active,auction")
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        title={<>The <span className="italic">market</span></>}
        description="Certified lots from growers, sold direct. Filter by crop, search by origin or variety, and open any lot to see its certificate."
      />

      <div className="sticky top-16 z-30 -mx-4 mb-8 px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="glass panel-flat flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2" />
            <label htmlFor="market-search" className="sr-only">Search lots</label>
            <input
              id="market-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search basmati, Sidama, Punjab, grade A…"
              className="bg-surface-2/60 placeholder:text-muted-foreground/70 focus:border-ring h-11 w-full rounded-full border pr-4 pl-11 text-[15px] outline-none transition-colors"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-surface-2/60 flex rounded-full border p-1" role="tablist" aria-label="Sale type">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  role="tab"
                  aria-selected={mode === m.value}
                  onClick={() => setMode(m.value)}
                  className={cn("rounded-full px-3.5 py-1.5 text-[13px] transition-colors", mode === m.value ? "bg-card text-foreground border shadow-sm" : "text-muted-foreground hover:text-foreground border border-transparent")}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setOrganic((o) => !o)}
              aria-pressed={organic}
              className={cn("inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-[13px] transition-colors", organic ? "bg-signal-soft text-signal border-signal/30" : "text-muted-foreground hover:text-foreground bg-surface-2/60")}
            >
              <Leaf className="size-3.5" /> Organic
            </button>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-[200px] rounded-full" aria-label="Sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          <Chip active={!type} onClick={() => setType("")}>Everything</Chip>
          {CROP_TYPES.filter((t) => t.value !== "other").map((t) => (
            <Chip key={t.value} active={type === t.value} onClick={() => setType(type === t.value ? "" : t.value)}>
              {t.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="text-muted-foreground mb-5 flex items-center justify-between text-sm">
        <span className="tabular">{data ? `${data.pagination.total} ${data.pagination.total === 1 ? "lot" : "lots"}` : "Loading lots…"}</span>
        {(q || type || organic || mode !== "active,auction") && (
          <button onClick={clear} className="hover:text-foreground underline underline-offset-4">Clear filters</button>
        )}
      </div>

      {error ? (
        <Empty icon={<SearchX />} title="The market didn't load" description={error.message} action={<Button onClick={() => location.reload()}>Try again</Button>} />
      ) : isLoading && !data ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <CropCardSkeleton key={i} />)}
        </div>
      ) : data?.data.length ? (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.data.map((crop) => <CropCard key={crop.id} crop={crop} />)}
          </div>
          {data.pagination.total_pages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-3">
              <Button variant="outline" size="icon" disabled={!data.pagination.has_prev} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft /></Button>
              <span className="tabular text-muted-foreground text-sm">Page {data.pagination.page} of {data.pagination.total_pages}</span>
              <Button variant="outline" size="icon" disabled={!data.pagination.has_next} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight /></Button>
            </div>
          )}
        </>
      ) : (
        <Empty icon={<SearchX />} title="No lots match" description="Try a different crop, a broader search, or clear the filters to see the whole market." action={<Button variant="outline" onClick={clear}>Clear filters</Button>} />
      )}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn("h-8 shrink-0 rounded-full border px-3.5 text-[13px] transition-colors", active ? "bg-foreground text-background border-foreground" : "text-muted-foreground hover:text-foreground hover:border-border-strong bg-card/60")}
    >
      {children}
    </button>
  )
}

export default function MarketplacePage() {
  return (
    <Suspense>
      <Marketplace />
    </Suspense>
  )
}
