import { route, body, requireUser } from "@/lib/server/http"
import { recordMint } from "@/lib/server/services"

type Ctx = { params: Promise<{ id: string }> }

export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser()
  return recordMint(user, (await params).id, await body(req))
})
