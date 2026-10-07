"use client"

import type { ReactNode } from "react"
import { Loader2, ShoppingBasket, Tractor, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useWallet } from "@/lib/wallet/wallet-provider"
import type { UserRole } from "@/lib/types/database"

/** Renders children only for a signed-in wallet (optionally in a given role); otherwise a clear next step. */
export function AuthGate({ children, role, reason }: { children: ReactNode; role?: UserRole; reason?: string }) {
  const { status, user, setConnectOpen, setRole } = useWallet()

  if (status === "restoring") {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <Gate
        icon={<Wallet />}
        title="Connect to continue"
        body={reason ?? "Sign in with your wallet to see this page. It takes one signature and no gas."}
        action={<Button size="lg" onClick={() => setConnectOpen(true)}>Connect wallet</Button>}
      />
    )
  }

  if (role && user.role !== role) {
    const farmer = role === "farmer"
    return (
      <Gate
        icon={farmer ? <Tractor /> : <ShoppingBasket />}
        title={farmer ? "This is a grower's space" : "This is a buyer's space"}
        body={farmer ? "Switch to farmer mode to list lots, run auctions and answer offers. You can switch back at any time." : "Switch to buyer mode to bid, make offers and track purchases."}
        action={<Button size="lg" onClick={() => setRole(role)}>Switch to {farmer ? "farmer" : "buyer"} mode</Button>}
      />
    )
  }

  return <>{children}</>
}

function Gate({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="bg-signal-soft text-signal mb-6 grid size-16 place-items-center rounded-[1.25rem] border border-signal/20 [&_svg]:size-7">{icon}</div>
      <h1 className="font-display text-4xl">{title}</h1>
      <p className="text-muted-foreground mt-3 leading-relaxed">{body}</p>
      <div className="mt-8">{action}</div>
    </div>
  )
}
