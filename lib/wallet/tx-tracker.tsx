"use client"

import Link from "next/link"
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react"
import { formatEther, type TransactionReceipt } from "ethers"
import { Check, CircleAlert, Database, ExternalLink, Loader2, Pickaxe, Radio, Signature } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CopyValue } from "@/components/bits"
import { chainConfig, explorerTx } from "@/lib/config"
import { errorMessage } from "@/lib/api"
import { cn } from "@/lib/utils"

type Stage = "sign" | "pending" | "mined" | "saving" | "done" | "error"

interface TxState {
  open: boolean
  label: string
  method: string
  rows: [string, string][]
  valueEth?: string
  stage: Stage
  hash?: string
  block?: number
  gasUsed?: string
  feeEth?: string
  extra?: [string, string][]
  error?: string
  /** True when the chain step succeeded and only the database step failed. */
  chainOk?: boolean
}

export interface TxHandle {
  sent: (hash: string) => void
  mined: (receipt: TransactionReceipt, extra?: [string, string][]) => void
  saving: () => void
  done: () => void
  fail: (error: unknown) => void
}

const Ctx = createContext<{ begin: (label: string, info: { method: string; rows: [string, string][]; valueEth?: string }) => TxHandle } | null>(null)

/** Shows every on-chain action as it happens: sign → broadcast → mined → recorded in the database. */
export function TxTrackerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TxState | null>(null)
  const seq = useRef(0)

  const begin = useCallback((label: string, info: { method: string; rows: [string, string][]; valueEth?: string }): TxHandle => {
    const id = ++seq.current
    setState({ open: true, label, method: info.method, rows: info.rows, valueEth: info.valueEth, stage: "sign" })
    const patch = (p: Partial<TxState>) => setState((s) => (s && seq.current === id ? { ...s, ...p } : s))
    return {
      sent: (hash) => patch({ stage: "pending", hash }),
      mined: (r, extra) => patch({ stage: "mined", block: r.blockNumber, gasUsed: r.gasUsed.toString(), feeEth: formatEther(r.fee), extra, chainOk: true }),
      saving: () => patch({ stage: "saving" }),
      done: () => patch({ stage: "done" }),
      fail: (e) => patch({ stage: "error", error: errorMessage(e) }),
    }
  }, [])

  const value = useMemo(() => ({ begin }), [begin])
  return (
    <Ctx.Provider value={value}>
      {children}
      <TxDialog state={state} onClose={() => setState((s) => (s ? { ...s, open: false } : s))} />
    </Ctx.Provider>
  )
}

export function useTxTracker() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useTxTracker must be used inside <TxTrackerProvider>")
  return ctx
}

const STEPS: { key: Stage; title: string; icon: ReactNode }[] = [
  { key: "sign", title: "Sign in your wallet", icon: <Signature /> },
  { key: "pending", title: `Broadcast to ${chainConfig.name}`, icon: <Radio /> },
  { key: "mined", title: "Mined in a block", icon: <Pickaxe /> },
  { key: "saving", title: "Recorded in Seed2Store (MongoDB)", icon: <Database /> },
]
const ORDER: Stage[] = ["sign", "pending", "mined", "saving", "done"]

function TxDialog({ state, onClose }: { state: TxState | null; onClose: () => void }) {
  if (!state) return null
  const at = state.stage === "error" ? (state.chainOk ? 3 : state.hash ? 1 : 0) : ORDER.indexOf(state.stage)
  const busy = state.stage !== "done" && state.stage !== "error"
  const etherscan = explorerTx(state.hash)

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{state.label}</DialogTitle>
          <DialogDescription>
            <span className="font-mono text-xs">{state.method}()</span> on <span className="font-mono text-xs">Seed2StoreNFT</span> · {chainConfig.name} (chain {chainConfig.id})
          </DialogDescription>
        </DialogHeader>

        <ol className="flex flex-col gap-1">
          {STEPS.map((s, i) => {
            const failedHere = state.stage === "error" && i === at
            const complete = i < at || state.stage === "done"
            const active = i === at && busy
            return (
              <li key={s.key} className={cn("flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors", active && "bg-surface-2/70")}>
                <span
                  className={cn(
                    "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border [&_svg]:size-3.5",
                    complete && "border-signal/40 bg-signal-soft text-signal",
                    failedHere && "border-destructive/40 bg-destructive/10 text-destructive",
                    !complete && !failedHere && "text-muted-foreground",
                  )}
                >
                  {complete ? <Check /> : failedHere ? <CircleAlert /> : active ? <Loader2 className="animate-spin" /> : s.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={cn("text-sm font-medium", !complete && !active && !failedHere && "text-muted-foreground")}>{s.title}</div>
                  {s.key === "sign" && active && <p className="text-muted-foreground text-xs">Approve the transaction in your wallet{state.valueEth ? ` · sends ${state.valueEth} ETH` : ""}.</p>}
                  {s.key === "pending" && state.hash && (
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs">
                      <CopyValue value={state.hash} display={`${state.hash.slice(0, 12)}…${state.hash.slice(-8)}`} />
                    </div>
                  )}
                  {s.key === "mined" && state.block != null && (
                    <p className="text-muted-foreground font-mono text-xs">
                      block #{state.block.toLocaleString()} · gas {Number(state.gasUsed).toLocaleString()} · fee {Number(state.feeEth).toFixed(6)} ETH
                    </p>
                  )}
                  {failedHere && <p className="text-destructive mt-0.5 text-xs leading-relaxed">{state.error}</p>}
                </div>
              </li>
            )
          })}
        </ol>

        <div className="bg-surface-2/50 rounded-2xl border p-3.5">
          <div className="text-muted-foreground mb-2 text-[11px] tracking-[0.12em] uppercase">Call arguments</div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            {[...state.rows, ...(state.valueEth ? [["msg.value", `${state.valueEth} ETH`] as [string, string]] : []), ...(state.extra ?? [])].map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground font-mono">{k}</dt>
                <dd className="truncate font-mono">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {state.hash && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/chain/tx/${state.hash}`} onClick={onClose}>Inspect transaction</Link>
            </Button>
          )}
          {etherscan && (
            <Button asChild variant="outline" size="sm">
              <a href={etherscan} target="_blank" rel="noreferrer">
                Etherscan <ExternalLink />
              </a>
            </Button>
          )}
          <Button size="sm" onClick={onClose} disabled={busy && state.stage === "sign" ? false : false}>
            {busy ? "Hide" : "Close"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
