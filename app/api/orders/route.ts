import { route, requireUser } from "@/lib/server/http"
import { listOrders } from "@/lib/server/services"

export const dynamic = "force-dynamic"

export const GET = route(async (req) => {
  const user = await requireUser()
  return listOrders(user, new URL(req.url).searchParams.get("as") === "farmer" ? "farmer" : "buyer")
})
