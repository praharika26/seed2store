import { isAddress } from "ethers"
import { route } from "@/lib/server/http"
import { walletBalance } from "@/lib/server/chain"
import { ApiError } from "@/lib/server/services"

export const dynamic = "force-dynamic"

export const GET = route(async (req) => {
  const address = new URL(req.url).searchParams.get("address") ?? ""
  if (!isAddress(address)) throw new ApiError(400, "A valid wallet address is required.")
  return walletBalance(address)
})
