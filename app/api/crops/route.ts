import { route, body, requireUser, originOf } from "@/lib/server/http"
import { createCrop, listCrops, setCropMetadataUri } from "@/lib/server/services"
import { buildMetadata, pinJSON, pinataConfigured } from "@/lib/server/ipfs"
import type { CreateCropRequest, CropFilters, CropStatus, PaginationParams } from "@/lib/types/database"

export const dynamic = "force-dynamic"

export const GET = route(async (req) => {
  const sp = new URL(req.url).searchParams
  const n = (k: string) => (sp.get(k) ? Number(sp.get(k)) : undefined)
  const filters: CropFilters = {
    q: sp.get("q") || undefined,
    crop_type: sp.get("crop_type") || undefined,
    location: sp.get("location") || undefined,
    organic_certified: sp.get("organic") === "true" ? true : undefined,
    min_price: n("min_price"),
    max_price: n("max_price"),
    status: sp.get("status") ? (sp.get("status")!.split(",") as CropStatus[]) : undefined,
  }
  const pagination: PaginationParams = {
    page: n("page") ?? 1,
    limit: Math.min(n("limit") ?? 12, 48),
    sort: (sp.get("sort") as PaginationParams["sort"]) || "newest",
  }
  return listCrops(filters, pagination)
})

export const POST = route(async (req) => {
  const user = await requireUser()
  const crop = await createCrop(user, await body<CreateCropRequest>(req))
  // Token metadata: pinned to IPFS when Pinata is configured, otherwise served by this app.
  let uri = `${originOf(req)}/api/metadata/${crop.id}`
  if (pinataConfigured()) {
    try {
      uri = `ipfs://${await pinJSON(buildMetadata(crop, user, originOf(req)), `seed2store-${crop.id}`)}`
    } catch (e) {
      console.warn("[ipfs] metadata pin failed, falling back to hosted metadata", e)
    }
  }
  return Response.json(await setCropMetadataUri(crop.id, uri), { status: 201 })
})
