import { route, requireUser } from "@/lib/server/http"
import { ApiError } from "@/lib/server/services"
import { storeImage } from "@/lib/server/ipfs"

const MAX_BYTES = 8 * 1024 * 1024

export const POST = route(async (req) => {
  await requireUser()
  const form = await req.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) throw new ApiError(400, "Attach an image file.")
  if (file.size > MAX_BYTES) throw new ApiError(413, "Images must be 8 MB or smaller.")
  try {
    return await storeImage(file)
  } catch (e) {
    throw new ApiError(400, e instanceof Error ? e.message : "Upload failed.")
  }
})
