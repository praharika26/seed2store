"use client"

import Link from "next/link"
import { use } from "react"
import { ArrowLeft, CircleAlert, CircleCheck, ExternalLink, Loader2 } from "lucide-react"
import { AddressLink, EthValue, EventBadge, EventSentence, JsonView, When } from "@/components/chain/chain-bits"
import { CopyValue, Empty, Pill, Skeleton } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { useApi } from "@/lib/api"
import { CHAIN_LABELS } from "@/lib/abi"
import { chainConfig, explorerTx } from "@/lib/config"
import type { ChainTxDetail } from "@/lib/types/chain"

export default function TxPage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = use(params)
  const { data: tx, error, isLoading } = useApi<ChainTxDetail>(`/api/chain/tx/${hash}`, { refreshInterval: (d) => (d?.status === "pending" ? 3000 : 0) })
  const ext = explorerTx(hash)

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/chain" className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"><ArrowLeft className="size-4" /> Ledger</Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2.2rem] leading-tight sm:text-[2.6rem]">Transaction <span className="italic">details</span></h1>
          <div className="mt-2"><CopyValue value={hash} className="text-muted-foreground" /></div>
        </div>
        {ext && <Button asChild variant="outline"><a href={ext} target="_blank" rel="noreferrer">View on Etherscan <ExternalLink /></a></Button>}
      </div>

      {isLoading ? (
        <Skeleton className="mt-8 h-96" />
      ) : error || !tx ? (
        <Empty className="mt-8" icon={<CircleAlert />} title="Transaction not found" description={error?.message ?? `This hash isn't on ${chainConfig.name}.`} />
      ) : (
        <>
          <section className="panel mt-8 divide-y">
            <Row k="Status">
              {tx.status === "success" ? <Pill tone="signal"><CircleCheck className="size-3.5" /> Success</Pill> : tx.status === "pending" ? <Pill tone="live"><Loader2 className="size-3.5 animate-spin" /> Pending</Pill> : <Pill tone="danger">Reverted</Pill>}
            </Row>
            <Row k="Function">
              {tx.method ? (
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{CHAIN_LABELS[tx.method.name] ?? tx.method.name}</span>
                  <code className="bg-surface-2 rounded-md px-2 py-0.5 font-mono text-[12px]">{tx.method.signature}</code>
                </span>
              ) : (
                <span className="text-muted-foreground">Not a Seed2Store call</span>
              )}
            </Row>
            <Row k="Block">{tx.blockNumber != null ? <span className="font-mono">#{tx.blockNumber.toLocaleString()} <span className="text-muted-foreground">· {tx.confirmations} confirmations</span></span> : "—"}</Row>
            <Row k="Timestamp"><When ts={tx.timestamp} />{tx.timestamp ? <span className="text-muted-foreground"> · {new Date(tx.timestamp * 1000).toLocaleString()}</span> : null}</Row>
            <Row k="From"><AddressLink address={tx.from} /></Row>
            <Row k="To (contract)"><AddressLink address={tx.to} /></Row>
            <Row k="Value"><EthValue eth={tx.valueEth} /></Row>
            <Row k="Gas used / limit"><span className="font-mono">{tx.gasUsed ? Number(tx.gasUsed).toLocaleString() : "—"} / {Number(tx.gasLimit).toLocaleString()}</span></Row>
            <Row k="Gas price"><span className="font-mono">{tx.gasPriceGwei} gwei</span></Row>
            <Row k="Transaction fee"><span className="font-mono">{tx.feeEth ? `${Number(tx.feeEth).toFixed(8)} ETH` : "—"}</span></Row>
            <Row k="Nonce"><span className="font-mono">{tx.nonce}</span></Row>
          </section>

          {tx.method && (
            <section className="mt-8">
              <h2 className="font-display text-2xl">Decoded input</h2>
              <p className="text-muted-foreground mt-1 text-sm">The function arguments, decoded with the contract ABI.</p>
              <JsonView className="mt-3" value={tx.method.args} />
            </section>
          )}

          <section className="mt-8">
            <h2 className="font-display text-2xl">Events emitted <span className="text-muted-foreground font-sans text-base font-normal">({tx.events.length})</span></h2>
            <div className="mt-3 flex flex-col gap-3">
              {tx.events.map((e) => (
                <div key={e.logIndex} className="panel-flat p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3"><EventBadge name={e.name} /><EventSentence e={e} /></div>
                    <span className="text-muted-foreground font-mono text-xs">log #{e.logIndex}</span>
                  </div>
                  <JsonView className="mt-3 max-h-56" value={e.args} />
                </div>
              ))}
            </div>
          </section>

          <details className="mt-8">
            <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm">Raw input data ({(tx.input.length - 2) / 2} bytes)</summary>
            <pre className="bg-surface-2/60 mt-3 max-h-64 overflow-auto rounded-2xl border p-4 font-mono text-[11px] break-all whitespace-pre-wrap">{tx.input}</pre>
          </details>
        </>
      )}
    </div>
  )
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 px-5 py-3.5 text-sm sm:grid-cols-[180px_1fr] sm:gap-6">
      <span className="text-muted-foreground">{k}</span>
      <span className="min-w-0">{children}</span>
    </div>
  )
}
