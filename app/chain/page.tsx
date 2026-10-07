"use client"

import { useMemo, useState } from "react"
import { Blocks, ExternalLink, FileCode2, Unplug } from "lucide-react"
import { AddressLink, EthValue, EventBadge, EventSentence, TxLink, When } from "@/components/chain/chain-bits"
import { CopyValue, Empty, PageHeader, Pill, Skeleton } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { useApi } from "@/lib/api"
import { chainConfig, explorerAddress } from "@/lib/config"
import { CHAIN_LABELS } from "@/lib/abi"
import { cn } from "@/lib/utils"
import type { ChainEvent, ChainSummary } from "@/lib/types/chain"

const FILTERS = ["all", "CropCertificateCreated", "AuctionCreated", "BidPlaced", "AuctionFinalized", "CropSold", "Transfer"]

export default function ChainExplorerPage() {
  const { data: summary, error: sumErr } = useApi<ChainSummary | null>(chainConfig.enabled ? "/api/chain/summary" : null, { refreshInterval: 12_000 })
  const { data: events, isLoading } = useApi<ChainEvent[]>(chainConfig.enabled ? "/api/chain/events?limit=300" : null, { refreshInterval: 12_000 })
  const [filter, setFilter] = useState("all")
  const rows = useMemo(() => (events ?? []).filter((e) => filter === "all" || e.name === filter), [events, filter])

  if (!chainConfig.enabled) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <PageHeader title={<>On-chain <span className="italic">ledger</span></>} />
        <Empty icon={<Unplug />} title="No contract configured" description="Deploy Seed2StoreNFT (npm run deploy:sepolia or deploy:local) and restart the app to see every mint, auction, bid and sale here." />
      </div>
    )
  }

  const contractHref = explorerAddress(chainConfig.nftContract)

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        title={<>On-chain <span className="italic">ledger</span></>}
        description={`Every certificate mint, auction, bid, sale and NFT transfer emitted by the Seed2Store contract on ${chainConfig.name}, read straight from the chain.`}
        actions={contractHref ? <Button asChild variant="outline"><a href={contractHref} target="_blank" rel="noreferrer">Contract on Etherscan <ExternalLink /></a></Button> : undefined}
      />

      {/* Contract card */}
      <section className="panel mb-6 grid gap-6 p-6 lg:grid-cols-[1.2fr_2fr]">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-gold-soft text-gold grid size-10 place-items-center rounded-xl border border-gold/25"><FileCode2 className="size-5" /></span>
            <div>
              <div className="font-display text-xl">{summary?.name ?? "Seed2StoreNFT"} <span className="text-muted-foreground font-mono text-sm">({summary?.symbol ?? "S2SC"})</span></div>
              <div className="text-muted-foreground text-xs">ERC-721 · certificates, escrowed auctions, direct purchase</div>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Address</dt><dd><CopyValue value={chainConfig.nftContract!} display={`${chainConfig.nftContract!.slice(0, 10)}…${chainConfig.nftContract!.slice(-8)}`} href={contractHref} /></dd>
            <dt className="text-muted-foreground">Network</dt><dd className="flex items-center gap-2">{chainConfig.name} <Pill tone="signal" dot>chain {chainConfig.id}</Pill></dd>
            <dt className="text-muted-foreground">Owner</dt><dd>{summary ? <AddressLink address={summary.owner} /> : "…"}</dd>
            <dt className="text-muted-foreground">Platform fee</dt><dd>{summary ? `${summary.platformFeeBps / 100}%` : "…"}</dd>
            <dt className="text-muted-foreground">Latest block</dt><dd className="font-mono">{summary ? `#${summary.latestBlock.toLocaleString()}` : "…"}</dd>
          </dl>
          {sumErr && <p className="text-destructive mt-3 text-sm">{sumErr.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-3">
          {[
            ["Certificates minted", summary?.certificatesMinted],
            ["Auctions created", summary?.auctionsCreated],
            ["Bids placed", summary?.bidsPlaced],
            ["Lots sold on-chain", summary?.lotsSold],
            ["Volume", summary ? `${Number(summary.volumeEth).toFixed(4)} ETH` : undefined],
            ["Fees held by contract", summary ? `${Number(summary.feesHeldEth).toFixed(5)} ETH` : undefined],
          ].map(([label, value]) => (
            <div key={label as string} className="bg-card p-4">
              <div className="text-muted-foreground text-xs">{label}</div>
              <div className="tabular mt-1 text-2xl font-medium tracking-tight">{value ?? <Skeleton className="h-7 w-16" />}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Filters */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const count = f === "all" ? events?.length : events?.filter((e) => e.name === f).length
          return (
            <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={cn("h-9 shrink-0 rounded-full border px-4 text-[13px] transition-colors", filter === f ? "bg-foreground text-background border-foreground" : "text-muted-foreground hover:text-foreground")}>
              {f === "all" ? "All events" : CHAIN_LABELS[f]} <span className="tabular ml-1 opacity-60">{count ?? ""}</span>
            </button>
          )
        })}
      </div>

      {/* Event table */}
      {isLoading && !events ? (
        <Skeleton className="h-80" />
      ) : !rows.length ? (
        <Empty icon={<Blocks />} title="No events yet" description="Mint a certificate from any lot page; it appears here within seconds with its transaction hash and block." />
      ) : (
        <div className="panel-flat overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs">
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">What happened</th>
                <th className="px-4 py-3 text-right font-medium">Value</th>
                <th className="px-4 py-3 font-medium">Transaction</th>
                <th className="px-4 py-3 text-right font-medium">Block</th>
                <th className="px-4 py-3 text-right font-medium">Age</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={`${e.txHash}-${e.logIndex}`} className="hover:bg-accent/30 border-b last:border-0">
                  <td className="px-4 py-3"><EventBadge name={e.name} /></td>
                  <td className="px-4 py-3"><EventSentence e={e} /></td>
                  <td className="px-4 py-3 text-right">{e.valueEth ? <EthValue eth={e.valueEth} className="items-end" /> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3"><TxLink hash={e.txHash} /></td>
                  <td className="px-4 py-3 text-right font-mono text-[12.5px]">#{e.blockNumber.toLocaleString()}</td>
                  <td className="text-muted-foreground px-4 py-3 text-right text-[12.5px]"><When ts={e.timestamp} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
