import { route, requireUser } from "@/lib/server/http"
import { farmerCrops } from "@/lib/server/services"

export const dynamic = "force-dynamic"
export const GET = route(async () => farmerCrops(await requireUser()))
