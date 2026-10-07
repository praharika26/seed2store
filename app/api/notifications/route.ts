import { route, body, requireUser } from "@/lib/server/http"
import { listNotifications, markNotificationsRead } from "@/lib/server/services"

export const dynamic = "force-dynamic"

export const GET = route(async () => listNotifications(await requireUser()))

export const PATCH = route(async (req) => {
  const user = await requireUser()
  const { ids } = await body<{ ids?: string[] }>(req)
  await markNotificationsRead(user, ids)
  return { ok: true }
})
