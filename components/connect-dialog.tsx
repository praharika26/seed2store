"use client"

import { ArrowRight, Flame, Loader2, ShieldCheck, Wallet } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useWallet } from "@/lib/wallet/wallet-provider"
import { chainConfig } from "@/lib/config"
import { cn } from "@/lib/utils"

export function ConnectDialog() {
  const { connectOpen, setConnectOpen, wallets, connectInjected, connectBurner, status } = useWallet()
  const busy = status === "connecting" || status === "signing"

  return (
    <Dialog open={connectOpen} onOpenChange={(o) => !busy && setConnectOpen(o)}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl font-normal">Connect a wallet</DialogTitle>
          <DialogDescription className="leading-relaxed">
            Your wallet is your account. You&apos;ll sign a free message to prove it&apos;s yours, so no transaction and no gas.
          </DialogDescription>
        </DialogHeader>

        {busy ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <Loader2 className="text-signal size-8 animate-spin" />
            <div>
              <p className="font-medium">{status === "signing" ? "Check your wallet to sign" : "Waiting for your wallet"}</p>
              <p className="text-muted-foreground mt-1 text-sm">
                {status === "signing" ? "Approve the “Sign in to Seed2Store” message." : "Approve the connection request."}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {wallets.map((w) => (
              <WalletRow key={w.id} onClick={() => connectInjected(w)} icon={w.icon ? <img src={w.icon} alt="" className="size-7 rounded-lg" /> : <Wallet className="size-5" />} title={w.name} subtitle="Browser extension" />
            ))}
            {wallets.length === 0 && (
              <div className="text-muted-foreground rounded-2xl border border-dashed px-4 py-3.5 text-sm leading-relaxed">
                No browser wallet detected.{" "}
                <a href="https://metamask.io/download/" target="_blank" rel="noreferrer" className="text-foreground underline">
                  Install MetaMask
                </a>{" "}
                or any EVM wallet, or try a burner wallet below.
              </div>
            )}
            <div className="my-2 flex items-center gap-3">
              <div className="rule flex-1" />
              <span className="text-muted-foreground text-[11px] tracking-[0.14em] uppercase">or explore instantly</span>
              <div className="rule flex-1" />
            </div>
            <WalletRow
              onClick={connectBurner}
              icon={<Flame className="text-live size-5" />}
              title="Burner wallet"
              subtitle={chainConfig.enabled && chainConfig.isLocal ? "Kept in this browser, auto-funded on the local chain" : "A throwaway key kept in this browser"}
            />
          </div>
        )}

        <p className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed">
          <ShieldCheck className="text-signal mt-px size-4 shrink-0" />
          Sessions are signed server-side and expire after 7 days. We never ask for your seed phrase.
        </p>
      </DialogContent>
    </Dialog>
  )
}

function WalletRow({ icon, title, subtitle, onClick }: { icon: React.ReactNode; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("group bg-surface-2/50 hover:bg-surface-2 flex items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left transition-colors hover:border-border-strong")}
    >
      <span className="bg-card grid size-11 place-items-center rounded-xl border">{icon}</span>
      <span className="flex-1">
        <span className="block font-medium">{title}</span>
        <span className="text-muted-foreground block text-[13px]">{subtitle}</span>
      </span>
      <ArrowRight className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}
