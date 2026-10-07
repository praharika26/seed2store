import { route } from "@/lib/server/http"
import { getChainTx } from "@/lib/server/chain"
import { ApiError, lotsByToken } from "@/lib/server/services"

type Ctx = { params: Promise<{ hash: string }> }
export const dynamic = "force-dynamic"

export const GET = route<Ctx>(async (_req, { params }) => {
  const { hash } = await params
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new ApiError(400, "That isn't a transaction hash.")
  const tx = await getChainTx(hash)
  if (!tx) throw new ApiError(404, "Transaction not found on this network.")
  const lots = await lotsByToken(tx.events.map((e) => e.tokenId ?? NaN))
  return {
    ...tx,
    events: tx.events.map((e) => {
      const lot = e.tokenId != null ? lots.get(e.tokenId) : undefined
      return { ...e, lot: lot ? { id: lot.id, title: lot.title } : null }
    }),
  }
})
