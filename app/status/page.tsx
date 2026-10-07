"use client"

import { CircleAlert, CircleCheck, CircleDashed, Loader2 } from "lucide-react"
import { PageHeader } from "@/components/bits"
import { useApi } from "@/lib/api"
import { cn } from "@/lib/utils"

interface Status {
  database: { kind: "local" | "mongodb"; label: string; ok: boolean; error?: string }
  chain: { configured: boolean; reachable?: boolean; block?: number; contractDeployed?: boolean; error?: string; name: string; id: number; rpcUrl: string; nftContract?: string; isLocal: boolean }
  storage: "pinata" | "gridfs" | "local"
  ethUsd: number
  authSecret: boolean
}

export default function StatusPage() {
  const { data } = useApi<Status>("/api/status", { refreshInterval: 15_000 })
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader title={<>Network <span className="italic">status</span></>} description="What this deployment is connected to. Everything degrades gracefully: without a chain, lots are content-hashed off-chain." />
      {!data ? (
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      ) : (
        <div className="flex flex-col gap-3">
          <Item
            state={data.database.ok ? "ok" : "bad"}
            title={data.database.kind === "mongodb" ? "MongoDB" : "Local database"}
            body={data.database.ok ? (data.database.kind === "mongodb" ? `Connected to ${data.database.label}. Lots, bids, offers, orders, notifications, photos (GridFS) and settings all live here.` : "Zero-config JSON store at .data/seed2store.json, seeded with demo lots. Set MONGODB_URI to use MongoDB.") : `${data.database.label}: ${data.database.error ?? "unavailable"}`}
          />
          <Item
            state={!data.chain.configured ? "off" : data.chain.reachable && data.chain.contractDeployed ? "ok" : "bad"}
            title={`Blockchain · ${data.chain.name} (${data.chain.id})`}
            body={
              !data.chain.configured
                ? "No certificate contract configured. Run `npm run chain` then `npm run deploy:local` to enable on-chain certificates, escrowed auctions and direct purchase."
                : !data.chain.reachable
                  ? `RPC ${data.chain.rpcUrl} is unreachable: ${data.chain.error}`
                  : !data.chain.contractDeployed
                    ? `No contract code at ${data.chain.nftContract}. Redeploy and restart the app.`
                    : `Block ${data.chain.block?.toLocaleString()} · contract ${data.chain.nftContract}`
            }
          />
          <Item
            state={data.storage === "local" ? "off" : "ok"}
            title={data.storage === "pinata" ? "IPFS via Pinata" : data.storage === "gridfs" ? "Photos in MongoDB GridFS" : "Local file storage"}
            body={data.storage === "pinata" ? "Photos and token metadata are pinned to IPFS." : data.storage === "gridfs" ? "Photos are stored content-addressed in the `uploads` GridFS bucket. Set PINATA_JWT to pin to IPFS instead." : "Photos are stored content-addressed under .data/uploads."}
          />
          <Item state={data.authSecret ? "ok" : "off"} title="Session signing" body={data.authSecret ? "AUTH_SECRET is set." : `Using an auto-generated secret stored in the ${data.database.kind === "mongodb" ? "MongoDB meta collection" : "local database"}. Set AUTH_SECRET to manage it yourself.`} />
          <Item state="ok" title="Price oracle" body={`Fixed rate: 1 ETH = $${data.ethUsd.toLocaleString()} (NEXT_PUBLIC_ETH_USD).`} />
        </div>
      )}
    </div>
  )
}

function Item({ state, title, body }: { state: "ok" | "bad" | "off"; title: string; body: string }) {
  return (
    <div className={cn("panel-flat flex items-start gap-4 p-5", state === "bad" && "border-destructive/40")}>
      {state === "ok" ? <CircleCheck className="text-signal size-5 shrink-0" /> : state === "bad" ? <CircleAlert className="text-destructive size-5 shrink-0" /> : <CircleDashed className="text-muted-foreground size-5 shrink-0" />}
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed break-words">{body}</p>
      </div>
    </div>
  )
}
