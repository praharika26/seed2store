import { route, body, requireUser } from "@/lib/server/http"
import { recordAuctionFinalized } from "@/lib/server/services"

type Ctx = { params: Promise<{ id: string }> }

export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser()
  const { transaction_hash } = await body<{ transaction_hash: string }>(req)
  return recordAuctionFinalized(user, (await params).id, transaction_hash)
})
