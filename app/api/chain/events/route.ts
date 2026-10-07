import { route } from "@/lib/server/http"
import { listChainEvents } from "@/lib/server/chain"
import { lotsByToken } from "@/lib/server/services"

export const dynamic = "force-dynamic"

export const GET = route(async (req) => {
  const sp = new URL(req.url).searchParams
  const token = sp.get("token")
  const limit = Math.min(Number(sp.get("limit") ?? 200), 500)
  let events = await listChainEvents()
  if (token) events = events.filter((e) => e.tokenId === Number(token))
  events = events.slice(0, limit)
  const lots = await lotsByToken(events.map((e) => e.tokenId ?? NaN))
  return events.map((e) => {
    const lot = e.tokenId != null ? lots.get(e.tokenId) : undefined
    return { ...e, lot: lot ? { id: lot.id, title: lot.title } : null }
  })
})
