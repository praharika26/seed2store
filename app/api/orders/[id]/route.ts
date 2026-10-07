import { route, body, requireUser } from "@/lib/server/http"
import { updateOrder, type OrderAction } from "@/lib/server/services"

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser()
  const { action } = await body<{ action: OrderAction }>(req)
  return updateOrder(user, (await params).id, action)
})
