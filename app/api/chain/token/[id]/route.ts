import { route } from "@/lib/server/http"
import { getTokenDetail } from "@/lib/server/chain"
import { ApiError, lotsByToken } from "@/lib/server/services"

type Ctx = { params: Promise<{ id: string }> }
export const dynamic = "force-dynamic"

export const GET = route<Ctx>(async (_req, { params }) => {
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) throw new ApiError(400, "Token IDs are positive whole numbers.")
  const token = await getTokenDetail(id)
  if (!token) throw new ApiError(404, `Token #${id} doesn't exist on this contract.`)
  const lot = (await lotsByToken([id])).get(id)
  return {
    ...token,
    lot: lot ? { id: lot.id, title: lot.title, crop_type: lot.crop_type, images: lot.images, farmer: lot.farmer } : null,
  }
})
