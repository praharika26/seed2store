import { route, body, requireUser } from "@/lib/server/http"
import { updateProfile } from "@/lib/server/services"
import type { UserRole } from "@/lib/types/database"

export const PATCH = route(async (req) => {
  const user = await requireUser()
  const patch = await body<{ role?: UserRole; display_name?: string; location?: string; bio?: string }>(req)
  return { user: await updateProfile(user, patch) }
})
