import { route, requireUser } from "@/lib/server/http"
import { userBids } from "@/lib/server/services"

export const dynamic = "force-dynamic"
export const GET = route(async () => userBids(await requireUser()))
