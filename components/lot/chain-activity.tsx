"use client"

import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { EthValue, EventBadge, EventSentence, TxLink, When } from "@/components/chain/chain-bits"
import { useApi } from "@/lib/api"
import { chainConfig } from "@/lib/config"
import type { ChainEvent } from "@/lib/types/chain"
import type { Crop } from "@/lib/types/database"

/** Every contract event for this lot's NFT: the mint, auctions, bids, the sale and transfers. */
export function ChainActivity({ crop }: { crop: Crop }) {
  const enabled = chainConfig.enabled && crop.nft_minted && crop.nft_token_id != null
  const { data } = useApi<ChainEvent[]>(enabled ? `/api/chain/events?token=${crop.nft_token_id}` : null, { refreshInterval: 10_000 })
  if (!enabled) return null

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-3xl">On-chain activity</h2>
        <Link href={`/token/${crop.nft_token_id}`} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
          NFT #{crop.nft_token_id} <ArrowUpRight className="size-4" />
        </Link>
      </div>
      <p className="text-muted-foreground mt-1 text-sm">Read live from the Seed2Store contract on {chainConfig.name}. Every row is a real transaction.</p>
      <ol className="mt-4 flex flex-col">
        {!data ? (
          <li className="text-muted-foreground py-3 text-sm">Reading the chain…</li>
        ) : data.length === 0 ? (
          <li className="text-muted-foreground py-3 text-sm">No events found yet.</li>
        ) : (
          [...data].reverse().map((e) => (
            <li key={`${e.txHash}-${e.logIndex}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t py-3 text-sm last:border-b">
              <EventBadge name={e.name} />
              <span className="min-w-0 flex-1"><EventSentence e={e} /></span>
              {e.valueEth && <EthValue eth={e.valueEth} className="items-end" />}
              <TxLink hash={e.txHash} />
              <span className="text-muted-foreground w-16 text-right text-xs"><When ts={e.timestamp} /></span>
            </li>
          ))
        )}
      </ol>
    </section>
  )
}
