import { route } from "@/lib/server/http"
import { getStore } from "@/lib/server/store"
import { chainStatus } from "@/lib/server/chain"
import { pinataConfigured } from "@/lib/server/ipfs"
import { chainConfig, ETH_USD } from "@/lib/config"

export const dynamic = "force-dynamic"

export const GET = route(async () => {
  const store = getStore()
  let database: { kind: string; label: string; ok: boolean; error?: string }
  try {
    await store.ping()
    database = { kind: store.kind, label: store.label, ok: true }
  } catch (e) {
    database = { kind: store.kind, label: store.label, ok: false, error: e instanceof Error ? e.message : String(e) }
  }
  return {
    database,
    chain: { ...chainConfig, ...(await chainStatus()) },
    storage: pinataConfigured() ? "pinata" : store.kind === "mongodb" ? "gridfs" : "local",
    ethUsd: ETH_USD,
    authSecret: Boolean(process.env.AUTH_SECRET),
  }
})
