import { route, body, requireUser } from "@/lib/server/http"
import { createOffer, offersReceived, offersSent } from "@/lib/server/services"
import type { CreateOfferRequest } from "@/lib/types/database"

export const dynamic = "force-dynamic"

export const GET = route(async (req) => {
  const user = await requireUser()
  return new URL(req.url).searchParams.get("type") === "sent" ? offersSent(user) : offersReceived(user)
})

export const POST = route(async (req) => {
  const user = await requireUser()
  return Response.json(await createOffer(user, await body<CreateOfferRequest>(req)), { status: 201 })
})
