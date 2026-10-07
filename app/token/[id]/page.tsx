"use client"

import Link from "next/link"
import { use } from "react"
import { ArrowLeft, CircleAlert, ExternalLink } from "lucide-react"
import { AddressLink, EthValue, EventBadge, EventSentence, JsonView, TxLink, When } from "@/components/chain/chain-bits"
import { CropMedia } from "@/components/crop-art"
import { CopyValue, Empty, Pill, Skeleton } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { useApi } from "@/lib/api"
import { chainConfig, explorerToken } from "@/lib/config"
import { formatEther } from "ethers"
import type { TokenDetail } from "@/lib/types/chain"

export default function TokenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: t, error, isLoading } = useApi<TokenDetail>(`/api/chain/token/${id}`)
  const ext = explorerToken(Number(id))
  const meta = (t?.metadata ?? null) as { name?: string; image?: string; attributes?: { trait_type: string; value: unknown }[] } | null
  const cert = t?.certificate as Record<string, string | boolean> | undefined

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/chain" className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"><ArrowLeft className="size-4" /> Ledger</Link>
      {isLoading ? (
        <Skeleton className="h-[480px]" />
      ) : error || !t ? (
        <Empty icon={<CircleAlert />} title={`Token #${id} not found`} description={error?.message ?? "This token doesn't exist on the configured contract."} />
      ) : (
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] [&>*]:min-w-0">
          {/* The NFT */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="relative overflow-hidden rounded-[24px] border border-gold/30 bg-card shadow-[0_30px_70px_-35px_hsl(var(--shadow-color)/0.8)]">
              <div className="aspect-square">
                {meta?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={meta.image.replace(/^ipfs:\/\//, "https://gateway.pinata.cloud/ipfs/")} alt={meta.name ?? ""} className="size-full object-cover" />
                ) : t.lot ? (
                  <CropMedia crop={{ id: t.lot.id, crop_type: t.lot.crop_type, images: t.lot.images, title: t.lot.title }} />
                ) : (
                  <div className="bg-surface-2 size-full" />
                )}
              </div>
              <div className="glass absolute top-4 left-4 rounded-full border px-3 py-1 font-mono text-xs">ERC-721 · #{t.tokenId}</div>
              <div className="border-t p-5">
                <div className="text-muted-foreground font-mono text-[11px] tracking-[0.14em] uppercase">Seed2Store Certificate</div>
                <div className="font-display mt-1 text-2xl">{String(cert?.title ?? meta?.name ?? `Certificate #${t.tokenId}`)}</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {t.lot && <Button asChild><Link href={`/crop/${t.lot.id}`}>Open the lot</Link></Button>}
              {ext && <Button asChild variant="outline"><a href={ext} target="_blank" rel="noreferrer">Etherscan <ExternalLink /></a></Button>}
              <Button asChild variant="outline"><a href={t.tokenURIResolved} target="_blank" rel="noreferrer">tokenURI JSON <ExternalLink /></a></Button>
            </div>
          </div>

          {/* Facts */}
          <div className="flex flex-col gap-8">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="gold">Token #{t.tokenId}</Pill>
                {cert?.isSold ? <Pill tone="signal">Sold</Pill> : cert?.isActive ? <Pill tone="signal" dot>Active</Pill> : <Pill>Inactive</Pill>}
                <Pill>{chainConfig.name}</Pill>
              </div>
              <h1 className="font-display mt-3 text-[2.2rem] leading-tight sm:text-[2.7rem]">On-chain <span className="italic">certificate</span></h1>
            </div>

            <section className="panel divide-y">
              <Row k="Current owner"><AddressLink address={t.owner} /></Row>
              <Row k="Issued by (grower)"><AddressLink address={String(cert?.farmer ?? "")} /></Row>
              <Row k="Contract"><CopyValue value={t.contract} display={`${t.contract.slice(0, 10)}…${t.contract.slice(-8)}`} /></Row>
              <Row k="Minted"><When ts={Number(cert?.createdAt ?? 0)} /></Row>
              <Row k="tokenURI"><a href={t.tokenURIResolved} target="_blank" rel="noreferrer" className="font-mono text-[12.5px] break-all underline decoration-border-strong underline-offset-4">{t.tokenURI}</a></Row>
              <Row k="Minimum price (lot)"><EthValue eth={formatEther(String(cert?.minimumPrice ?? "0"))} /></Row>
              <Row k="Buy-now price (lot)"><EthValue eth={formatEther(String(cert?.buyoutPrice ?? "0"))} /></Row>
            </section>

            <section>
              <h2 className="font-display text-2xl">Ownership & activity</h2>
              <ol className="mt-4 flex flex-col">
                {t.history.length === 0 && <li className="text-muted-foreground text-sm">No events yet.</li>}
                {[...t.history].reverse().map((e) => (
                  <li key={`${e.txHash}-${e.logIndex}`} className="flex flex-wrap items-center gap-3 border-t py-3 text-sm last:border-b">
                    <EventBadge name={e.name} />
                    <span className="min-w-0 flex-1"><EventSentence e={e} /></span>
                    {e.valueEth && e.name !== "AuctionCreated" ? <EthValue eth={e.valueEth} className="items-end" /> : null}
                    <TxLink hash={e.txHash} />
                    <span className="text-muted-foreground w-20 text-right text-xs"><When ts={e.timestamp} /></span>
                  </li>
                ))}
              </ol>
            </section>

            <section>
              <h2 className="font-display text-2xl">Stored on-chain</h2>
              <p className="text-muted-foreground mt-1 text-sm">The <code className="font-mono">CropCertificate</code> struct returned by <code className="font-mono">getCropCertificate({t.tokenId})</code>.</p>
              <JsonView className="mt-3 max-h-80" value={t.certificate} />
            </section>

            <section>
              <h2 className="font-display text-2xl">Metadata (IPFS)</h2>
              <p className="text-muted-foreground mt-1 text-sm">The ERC-721 metadata document the <code className="font-mono">tokenURI</code> points to{t.tokenURI.startsWith("ipfs://") ? ", pinned on IPFS via Pinata" : ""}.</p>
              {meta ? <JsonView className="mt-3 max-h-96" value={meta} /> : <p className="text-muted-foreground mt-3 text-sm">Metadata couldn't be fetched right now.</p>}
            </section>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 px-5 py-3.5 text-sm sm:grid-cols-[170px_1fr] sm:gap-6">
      <span className="text-muted-foreground">{k}</span>
      <span className="min-w-0">{children}</span>
    </div>
  )
}
