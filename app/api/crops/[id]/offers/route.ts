import { route, currentUser } from "@/lib/server/http"
import { cropOffers } from "@/lib/server/services"

type Ctx = { params: Promise<{ id: string }> }
export const dynamic = "force-dynamic"

export const GET = route<Ctx>(async (_req, { params }) => cropOffers((await params).id, await currentUser()))
