import { ETH_USD } from "@/lib/config"

const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 })
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })
const qty = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 })

export function formatUSD(value?: number | null, opts: { cents?: boolean } = {}) {
  if (value == null || Number.isNaN(value)) return "—"
  // Cents only where they carry information: small unit prices or fractional amounts.
  if ((opts.cents && Math.abs(value) < 100) || value % 1 !== 0) return usd2.format(value)
  return usd0.format(value)
}

export function formatCompactUSD(value: number) {
  return `$${compact.format(value)}`
}

export function formatQty(value?: number | null) {
  if (value == null) return "—"
  return qty.format(value)
}

export function usdToEth(usd: number) {
  return usd / ETH_USD
}

/** Fixed decimal string safe for ethers.parseEther (max 18 decimals, no exponent). */
export function usdToEthString(usd: number) {
  const eth = usdToEth(usd)
  return eth.toFixed(12).replace(/\.?0+$/, "") || "0"
}

export function formatEth(usd?: number | null) {
  if (usd == null) return "—"
  const eth = usdToEth(usd)
  return `${eth < 0.01 ? eth.toFixed(5) : eth < 10 ? eth.toFixed(4) : eth.toFixed(2)} ETH`
}

export function shortAddress(address?: string | null, size = 4) {
  if (!address) return "—"
  return `${address.slice(0, 2 + size)}…${address.slice(-size)}`
}

export function shortHash(hash?: string | null, size = 6) {
  if (!hash) return "—"
  return `${hash.slice(0, 2 + size)}…${hash.slice(-size)}`
}

export function displayName(user?: { display_name?: string | null; wallet_address?: string } | null) {
  if (!user) return "Unknown"
  return user.display_name || shortAddress(user.wallet_address)
}

export function timeAgo(iso?: string | null) {
  if (!iso) return ""
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.round(diff / 1000)
  if (s < 45) return "just now"
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function formatDate(iso?: string | null, withTime = false) {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  })
}

export function minimumNextBid(auction: { current_highest_bid?: number | null; starting_price: number; bid_increment: number }) {
  return auction.current_highest_bid ? auction.current_highest_bid + auction.bid_increment : auction.starting_price
}
