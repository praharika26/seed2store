import { isAddress } from "ethers"
import { route, originOf } from "@/lib/server/http"
import { issueNonce, signInMessage } from "@/lib/server/session"
import { ApiError } from "@/lib/server/services"

export const dynamic = "force-dynamic"

export const GET = route(async (req) => {
  const address = new URL(req.url).searchParams.get("address") ?? ""
  if (!isAddress(address)) throw new ApiError(400, "A valid wallet address is required.")
  const nonce = await issueNonce()
  return { message: signInMessage(address, nonce, originOf(req)) }
})
