"use client"

import Link from "next/link"
import { Award } from "lucide-react"
import { AuthGate } from "@/components/auth-gate"
import { CropArt, CropMedia } from "@/components/crop-art"
import { When } from "@/components/chain/chain-bits"
import { Empty, PageHeader, Skeleton } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { useApi } from "@/lib/api"
import { useWallet } from "@/lib/wallet/wallet-provider"
import { chainConfig } from "@/lib/config"

interface Owned {
  tokenId: number
  title: string
  lot: { id: string; crop_type: string; images: string[]; status: string } | null
  mintedAt: number | null
  mintTx: string | null
}

export default function CertificatesPage() {
  return (
    <AuthGate>
      <Certificates />
    </AuthGate>
  )
}

function Certificates() {
  const { address } = useWallet()
  const { data, isLoading } = useApi<{ held: Owned[]; issued: Owned[] }>(chainConfig.enabled && address ? `/api/chain/owned?address=${address}` : null)

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader title={<>My <span className="italic">certificates</span></>} description={`ERC-721 certificate NFTs in your wallet on ${chainConfig.name}, and the ones you've issued as a grower.`} />
      {!chainConfig.enabled ? (
        <Empty icon={<Award />} title="No contract configured" description="Certificates appear here once the Seed2Store contract is deployed." />
      ) : isLoading ? (
        <Skeleton className="h-72" />
      ) : (
        <div className="flex flex-col gap-12">
          <Grid title="In your wallet" items={data?.held ?? []} empty="You don't hold any certificates yet. Buy a certified lot, or win an on-chain auction, and the NFT lands here." />
          <Grid title="Issued by you" items={data?.issued ?? []} empty="Certificates you mint as a grower show up here." action={<Button asChild variant="outline"><Link href="/my-crops">Go to my lots</Link></Button>} />
        </div>
      )}
    </div>
  )
}

function Grid({ title, items, empty, action }: { title: string; items: Owned[]; empty: string; action?: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-muted-foreground mb-4 text-sm">{title} · {items.length}</h2>
      {!items.length ? (
        <Empty icon={<Award />} title="Nothing here yet" description={empty} action={action} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((t) => (
            <Link key={t.tokenId} href={`/token/${t.tokenId}`} className="panel lift group overflow-hidden">
              <div className="relative aspect-square overflow-hidden">
                {t.lot ? <CropMedia crop={{ id: t.lot.id, crop_type: t.lot.crop_type, images: t.lot.images, title: t.title }} /> : <CropArt seed={`token-${t.tokenId}`} />}
                <span className="glass absolute top-3 left-3 rounded-full border px-2.5 py-0.5 font-mono text-[11px]">#{t.tokenId}</span>
              </div>
              <div className="p-4">
                <div className="font-display line-clamp-1 text-lg">{t.title}</div>
                <div className="text-muted-foreground mt-1 flex items-center justify-between gap-2 text-xs">
                  <span>Minted <When ts={t.mintedAt} /></span>
                  {t.mintTx && <span className="font-mono">{t.mintTx.slice(0, 8)}…{t.mintTx.slice(-4)}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
