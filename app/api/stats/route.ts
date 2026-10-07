import { route, requireUser } from "@/lib/server/http"
import { buyerStats, farmerStats } from "@/lib/server/services"

export const dynamic = "force-dynamic"

export const GET = route(async () => {
  const user = await requireUser()
  return user.role === "farmer" ? farmerStats(user) : buyerStats(user)
})
