import { isAddress, verifyMessage } from "ethers"
import { route, body, originOf } from "@/lib/server/http"
import { consumeNonce, signInMessage, startSession } from "@/lib/server/session"
import { ApiError, findOrCreateUser } from "@/lib/server/services"

export const POST = route(async (req) => {
  const { address, signature } = await body<{ address: string; signature: string }>(req)
  if (!isAddress(address) || !signature) throw new ApiError(400, "Address and signature are required.")
  const nonce = await consumeNonce()
  if (!nonce) throw new ApiError(401, "Your sign-in request expired. Please try again.")
  let recovered: string
  try {
    recovered = verifyMessage(signInMessage(address, nonce, originOf(req)), signature)
  } catch {
    throw new ApiError(401, "That signature couldn't be read.")
  }
  if (recovered.toLowerCase() !== address.toLowerCase()) throw new ApiError(401, "Signature doesn't match this wallet.")
  await startSession(address)
  return { user: await findOrCreateUser(address) }
})
