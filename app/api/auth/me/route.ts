import { route, currentUser } from "@/lib/server/http"

export const dynamic = "force-dynamic"
export const GET = route(async () => ({ user: await currentUser() }))
