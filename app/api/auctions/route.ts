import { route, body, requireUser } from "@/lib/server/http"
import { createAuction, listAuctions } from "@/lib/server/services"
import type { CreateAuctionRequest } from "@/lib/types/database"

export const dynamic = "force-dynamic"

export const GET = route(async (req) => {
  const status = new URL(req.url).searchParams.get("status") === "ended" ? "ended" : "active"
  return listAuctions(status)
})

export const POST = route(async (req) => {
  const user = await requireUser()
  return Response.json(await createAuction(user, await body<CreateAuctionRequest>(req)), { status: 201 })
})
