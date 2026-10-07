import { route } from "@/lib/server/http"
import { marketStats } from "@/lib/server/services"

export const dynamic = "force-dynamic"
export const GET = route(async () => marketStats())
