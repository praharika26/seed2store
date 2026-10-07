import { route } from "@/lib/server/http"
import { ApiError, findCropForVerification, verifyCrop } from "@/lib/server/services"
import { readCertificate } from "@/lib/server/chain"

export const dynamic = "force-dynamic"

export const GET = route(async (req) => {
  const q = new URL(req.url).searchParams.get("q") ?? ""
  const crop = await findCropForVerification(q)
  if (!crop) throw new ApiError(404, "No certificate matches that ID, serial, token or hash.")
  const result = await verifyCrop(crop)
  const onchain = crop.nft_token_id ? await readCertificate(crop.nft_token_id) : null
  return { ...result, onchain }
})
