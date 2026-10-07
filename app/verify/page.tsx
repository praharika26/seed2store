"use client"

import Link from "next/link"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { CircleAlert, CircleCheck, CircleX, Link2, Loader2 } from "lucide-react"
import { Certificate } from "@/components/certificate"
import { Address } from "@/components/bits"
import { VerifyForm } from "@/components/home-client"
import { useApi } from "@/lib/api"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Crop, PublicUser } from "@/lib/types/database"

interface VerifyResult {
  crop: Crop
  farmer: PublicUser | null
  stored_hash: string | null
  computed_hash: string | null
  intact: boolean
  onchain: null | { error: string } | { tokenId: number; farmer: string; owner: string; title: string; metadataUri: string; isSold: boolean; createdAt: string }
}

export default function VerifyPage() {
  return (
    <Suspense>
      <Verify />
    </Suspense>
  )
}

function Verify() {
  const q = useSearchParams().get("q") ?? ""
  const { data, error, isLoading } = useApi<VerifyResult>(q ? `/api/verify?q=${encodeURIComponent(q)}` : null, { shouldRetryOnError: false })

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-[2.8rem] leading-[1.02] sm:text-6xl">
          Verify a <span className="italic">certificate</span>
        </h1>
        <p className="text-muted-foreground mx-auto mt-4 max-w-lg leading-relaxed">
          Enter a serial, token ID, lot ID or content hash. We recompute the fingerprint from the current record and, for minted lots, read the token from the chain.
        </p>
        <VerifyForm key={q} defaultValue={q} className="mx-auto mt-8 max-w-xl" />
      </div>

      <div className="mt-14">
        {!q ? null : isLoading ? (
          <div className="text-muted-foreground flex justify-center"><Loader2 className="size-6 animate-spin" /></div>
        ) : error ? (
          <div className="panel-flat mx-auto flex max-w-xl items-start gap-3 p-5">
            <CircleAlert className="text-live mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-medium">No match</p>
              <p className="text-muted-foreground mt-1 text-sm">{error.message} Check the serial for typos. It looks like S2S-XXXX-XXXX.</p>
            </div>
          </div>
        ) : data ? (
          <Result data={data} />
        ) : null}
      </div>
    </div>
  )
}

function Result({ data }: { data: VerifyResult }) {
  const chain = data.onchain && !("error" in data.onchain) ? data.onchain : null
  const chainError = data.onchain && "error" in data.onchain ? data.onchain.error : null
  const farmerMatches = chain && data.farmer ? chain.farmer === data.farmer.wallet_address : null

  const checks: { ok: boolean | null; title: string; body: string }[] = [
    {
      ok: data.intact,
      title: data.intact ? "Record intact" : "Record changed since registration",
      body: data.intact ? "Recomputed fingerprint matches the one sealed at registration." : "The provenance fields no longer hash to the sealed fingerprint. Treat this lot with caution.",
    },
    data.crop.nft_minted
      ? chain
        ? { ok: farmerMatches, title: farmerMatches ? "On-chain certificate matches" : "On-chain issuer mismatch", body: `Token #${chain.tokenId} was minted by ${chain.farmer.slice(0, 8)}… on ${formatDate(chain.createdAt)}.` }
        : { ok: null, title: "Chain unreachable", body: chainError ?? "Couldn't reach the network to read the token." }
      : { ok: null, title: "Not minted on-chain", body: "This lot is verified by content hash only. The grower hasn't minted an NFT certificate." },
  ]

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col gap-3">
        {checks.map((c) => (
          <div key={c.title} className={cn("panel-flat flex items-start gap-4 p-5", c.ok === true && "border-signal/30", c.ok === false && "border-destructive/40")}>
            {c.ok === true ? <CircleCheck className="text-signal size-6 shrink-0" /> : c.ok === false ? <CircleX className="text-destructive size-6 shrink-0" /> : <CircleAlert className="text-muted-foreground size-6 shrink-0" />}
            <div>
              <p className="font-display text-2xl leading-tight">{c.title}</p>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{c.body}</p>
            </div>
          </div>
        ))}
        <dl className="panel-flat mt-2 divide-y text-sm">
          <Row k="Sealed hash" v={<span className="font-mono text-xs break-all">{data.stored_hash}</span>} />
          <Row k="Recomputed" v={<span className={cn("font-mono text-xs break-all", data.intact ? "text-signal" : "text-destructive")}>{data.computed_hash}</span>} />
          {data.farmer && <Row k="Grower" v={<Address value={data.farmer.wallet_address} />} />}
          {chain && <Row k="Current holder" v={<Address value={chain.owner} />} />}
        </dl>
        <Link href={`/crop/${data.crop.id}`} className="mt-2 inline-flex items-center gap-1.5 text-sm underline decoration-border-strong underline-offset-4">
          <Link2 className="size-4" /> Open the lot
        </Link>
      </div>
      <Certificate crop={data.crop} farmer={data.farmer} animate />
    </div>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <dt className="text-muted-foreground shrink-0">{k}</dt>
      <dd className="min-w-0 sm:text-right">{v}</dd>
    </div>
  )
}
