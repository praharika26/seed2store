import { route } from "@/lib/server/http"
import { chainSummary } from "@/lib/server/chain"

export const dynamic = "force-dynamic"

export const GET = route(async () => chainSummary())
