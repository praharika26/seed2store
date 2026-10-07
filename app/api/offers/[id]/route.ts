import { route, body, requireUser } from "@/lib/server/http"
import { respondToOffer } from "@/lib/server/services"

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser()
  return respondToOffer(user, (await params).id, await body(req))
})
