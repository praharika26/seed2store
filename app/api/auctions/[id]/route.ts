import { route, requireUser } from "@/lib/server/http"
import { cancelAuction, getAuction } from "@/lib/server/services"

type Ctx = { params: Promise<{ id: string }> }
export const dynamic = "force-dynamic"

export const GET = route<Ctx>(async (_req, { params }) => getAuction((await params).id))
export const DELETE = route<Ctx>(async (_req, { params }) => cancelAuction(await requireUser(), (await params).id))
