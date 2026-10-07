import { route, body, requireUser } from "@/lib/server/http"
import { getCrop, setListing } from "@/lib/server/services"

type Ctx = { params: Promise<{ id: string }> }
export const dynamic = "force-dynamic"

export const GET = route<Ctx>(async (_req, { params }) => getCrop((await params).id))

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser()
  const { action } = await body<{ action: "delist" | "relist" }>(req)
  return setListing(user, (await params).id, action)
})
