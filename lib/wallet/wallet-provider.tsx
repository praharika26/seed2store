"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { BrowserProvider, JsonRpcProvider, Wallet, parseEther, type Eip1193Provider, type Signer } from "ethers"
import { toast } from "sonner"
import { api, errorMessage } from "@/lib/api"
import { chainConfig } from "@/lib/config"
import type { User, UserRole } from "@/lib/types/database"

// ---------------------------------------------------------------------------
// EIP-6963 multi-wallet discovery
// ---------------------------------------------------------------------------

export interface WalletOption {
  id: string
  name: string
  icon?: string
  rdns?: string
  provider: Eip1193Provider & { on?: (e: string, cb: (...a: unknown[]) => void) => void; removeListener?: (e: string, cb: (...a: unknown[]) => void) => void }
}

type AnnounceEvent = CustomEvent<{ info: { uuid: string; name: string; icon: string; rdns: string }; provider: WalletOption["provider"] }>

function useDiscoveredWallets() {
  const [wallets, setWallets] = useState<WalletOption[]>([])
  useEffect(() => {
    const found = new Map<string, WalletOption>()
    const onAnnounce = (event: Event) => {
      const { info, provider } = (event as AnnounceEvent).detail
      found.set(info.rdns || info.uuid, { id: info.uuid, name: info.name, icon: info.icon, rdns: info.rdns, provider })
      setWallets([...found.values()])
    }
    window.addEventListener("eip6963:announceProvider", onAnnounce)
    window.dispatchEvent(new Event("eip6963:requestProvider"))
    // Legacy injected wallet that doesn't speak EIP-6963.
    const legacy = setTimeout(() => {
      const eth = (window as unknown as { ethereum?: WalletOption["provider"] & { isMetaMask?: boolean } }).ethereum
      if (eth && found.size === 0) {
        found.set("injected", { id: "injected", name: eth.isMetaMask ? "MetaMask" : "Browser wallet", rdns: "injected", provider: eth })
        setWallets([...found.values()])
      }
    }, 400)
    return () => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce)
      clearTimeout(legacy)
    }
  }, [])
  return wallets
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

type Status = "restoring" | "disconnected" | "connecting" | "signing" | "connected"
type WalletKind = "injected" | "burner"
const KIND_KEY = "s2s.wallet"
const BURNER_KEY = "s2s.burner"

interface WalletContextValue {
  status: Status
  user: User | null
  address: string | null
  kind: WalletKind | null
  walletName: string | null
  wallets: WalletOption[]
  connectOpen: boolean
  setConnectOpen: (open: boolean) => void
  connectInjected: (wallet: WalletOption) => Promise<void>
  connectBurner: () => Promise<void>
  disconnect: () => Promise<void>
  refreshUser: () => Promise<void>
  updateProfile: (patch: { role?: UserRole; display_name?: string; location?: string; bio?: string }) => Promise<User>
  setRole: (role: UserRole) => Promise<void>
  /** Signer on the configured chain (switches/adds the network for browser wallets). */
  getSigner: () => Promise<Signer>
  burnerPrivateKey: () => string | null
}

const WalletContext = createContext<WalletContextValue | null>(null)

const store = {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : null
    } catch {
      return null
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {}
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key)
    } catch {}
  },
}

async function signIn(address: string, sign: (message: string) => Promise<string>) {
  const { message } = await api<{ message: string }>(`/api/auth/nonce?address=${address}`)
  const signature = await sign(message)
  const { user } = await api<{ user: User }>("/api/auth/verify", { method: "POST", json: { address, signature } })
  return user
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const wallets = useDiscoveredWallets()
  const [status, setStatus] = useState<Status>("restoring")
  const [user, setUser] = useState<User | null>(null)
  const [kind, setKind] = useState<WalletKind | null>(null)
  const [walletRdns, setWalletRdns] = useState<string | null>(null)
  const [connectOpen, setConnectOpen] = useState(false)
  const activeProvider = useRef<WalletOption["provider"] | null>(null)

  // Restore the server session on load.
  useEffect(() => {
    let cancelled = false
    api<{ user: User | null }>("/api/auth/me")
      .then(({ user }) => {
        if (cancelled) return
        const saved = store.get<{ kind: WalletKind; rdns?: string }>(KIND_KEY)
        if (user && saved) {
          setUser(user)
          setKind(saved.kind)
          setWalletRdns(saved.rdns ?? null)
          setStatus("connected")
        } else {
          setStatus("disconnected")
        }
      })
      .catch(() => !cancelled && setStatus("disconnected"))
    return () => {
      cancelled = true
    }
  }, [])

  const walletOption = useMemo(() => wallets.find((w) => w.rdns === walletRdns) ?? null, [wallets, walletRdns])
  useEffect(() => {
    if (kind === "injected" && walletOption) activeProvider.current = walletOption.provider
  }, [kind, walletOption])

  const disconnect = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {})
    store.remove(KIND_KEY)
    activeProvider.current = null
    setUser(null)
    setKind(null)
    setWalletRdns(null)
    setStatus("disconnected")
  }, [])

  // Sign out if the browser wallet switches to a different account.
  useEffect(() => {
    const provider = walletOption?.provider
    if (kind !== "injected" || !provider?.on || !user) return
    const onAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[]
      if (!accounts?.length || accounts[0].toLowerCase() !== user.wallet_address) {
        toast.info("Wallet account changed", { description: "Sign in again with the new account." })
        disconnect()
      }
    }
    provider.on("accountsChanged", onAccounts)
    return () => provider.removeListener?.("accountsChanged", onAccounts)
  }, [walletOption, kind, user, disconnect])

  const finishSignIn = useCallback((u: User, k: WalletKind, rdns?: string) => {
    store.set(KIND_KEY, { kind: k, rdns })
    setUser(u)
    setKind(k)
    setWalletRdns(rdns ?? null)
    setStatus("connected")
    setConnectOpen(false)
    toast.success("Wallet connected", { description: u.display_name ? `Welcome back, ${u.display_name}.` : "You're signed in to Seed2Store." })
  }, [])

  const connectInjected = useCallback(async (wallet: WalletOption) => {
    setStatus("connecting")
    try {
      const accounts = (await wallet.provider.request({ method: "eth_requestAccounts" })) as string[]
      if (!accounts?.length) throw new Error("No account was shared by the wallet.")
      const address = accounts[0]
      setStatus("signing")
      const u = await signIn(address, (message) => wallet.provider.request({ method: "personal_sign", params: [message, address] }) as Promise<string>)
      activeProvider.current = wallet.provider
      finishSignIn(u, "injected", wallet.rdns)
    } catch (e) {
      setStatus(user ? "connected" : "disconnected")
      toast.error("Couldn't connect", { description: errorMessage(e) })
    }
  }, [finishSignIn, user])

  const connectBurner = useCallback(async () => {
    setStatus("connecting")
    try {
      let pk = store.get<string>(BURNER_KEY)
      if (!pk) {
        pk = Wallet.createRandom().privateKey
        store.set(BURNER_KEY, pk)
      }
      const wallet = new Wallet(pk)
      setStatus("signing")
      const u = await signIn(wallet.address, (m) => wallet.signMessage(m))
      finishSignIn(u, "burner")
    } catch (e) {
      setStatus("disconnected")
      toast.error("Couldn't start the burner wallet", { description: errorMessage(e) })
    }
  }, [finishSignIn])

  const refreshUser = useCallback(async () => {
    const { user } = await api<{ user: User | null }>("/api/auth/me")
    if (user) setUser(user)
  }, [])

  const updateProfile = useCallback(async (patch: Parameters<WalletContextValue["updateProfile"]>[0]) => {
    const { user } = await api<{ user: User }>("/api/me", { method: "PATCH", json: patch })
    setUser(user)
    return user
  }, [])

  const setRole = useCallback(async (role: UserRole) => {
    await updateProfile({ role })
    toast.success(role === "farmer" ? "Farmer mode" : "Buyer mode", { description: role === "farmer" ? "List lots, run auctions and manage offers." : "Browse lots, bid and buy." })
  }, [updateProfile])

  const getSigner = useCallback(async (): Promise<Signer> => {
    if (!user) throw new Error("Connect your wallet first.")
    if (!chainConfig.enabled) throw new Error("No Seed2Store contract is configured for this deployment.")

    if (kind === "burner") {
      const pk = store.get<string>(BURNER_KEY)
      if (!pk) throw new Error("Burner key missing — reconnect the burner wallet.")
      const rpc = new JsonRpcProvider(chainConfig.rpcUrl, chainConfig.id, { staticNetwork: true })
      const wallet = new Wallet(pk, rpc)
      const balance = await rpc.getBalance(wallet.address)
      if (!chainConfig.isLocal && balance === 0n) {
        throw new Error(`Your burner wallet ${wallet.address} has no ${chainConfig.name} ETH. Send it some test ETH from a faucet (see Profile), or use MetaMask.`)
      }
      if (chainConfig.isLocal && balance < parseEther("1")) {
        const hundred = "0x56BC75E2D63100000"
        await rpc.send("hardhat_setBalance", [wallet.address, hundred]).catch(() => rpc.send("evm_setAccountBalance", [wallet.address, hundred]))
      }
      return wallet
    }

    const provider = activeProvider.current ?? walletOption?.provider
    if (!provider) throw new Error("Your browser wallet isn't available. Unlock it, then try again.")
    const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[]
    if (accounts[0]?.toLowerCase() !== user.wallet_address) {
      throw new Error(`Switch your wallet to ${user.wallet_address.slice(0, 6)}…${user.wallet_address.slice(-4)}, the account you signed in with.`)
    }
    const current = (await provider.request({ method: "eth_chainId" })) as string
    if (parseInt(current, 16) !== chainConfig.id) {
      try {
        await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainConfig.hexId }] })
      } catch (e) {
        const code = (e as { code?: number }).code
        if (code !== 4902 && code !== -32603) throw e
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [{ chainId: chainConfig.hexId, chainName: chainConfig.name, rpcUrls: [chainConfig.rpcUrl], nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, ...(chainConfig.explorerUrl ? { blockExplorerUrls: [chainConfig.explorerUrl] } : {}) }],
        })
      }
    }
    return new BrowserProvider(provider).getSigner()
  }, [user, kind, walletOption])

  const value = useMemo<WalletContextValue>(() => ({
    status,
    user,
    address: user?.wallet_address ?? null,
    kind,
    walletName: kind === "burner" ? "Burner wallet" : walletOption?.name ?? (kind ? "Browser wallet" : null),
    wallets,
    connectOpen,
    setConnectOpen,
    connectInjected,
    connectBurner,
    disconnect,
    refreshUser,
    updateProfile,
    setRole,
    getSigner,
    burnerPrivateKey: () => (kind === "burner" ? store.get<string>(BURNER_KEY) : null),
  }), [status, user, kind, walletOption, wallets, connectOpen, connectInjected, connectBurner, disconnect, refreshUser, updateProfile, setRole, getSigner])

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>")
  return ctx
}
