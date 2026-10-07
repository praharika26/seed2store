import "server-only"
import { getStore } from "./store"
import { computeContentHash } from "@/lib/certificate"
import { DateValidator } from "@/lib/validation/date-validator"
import { minimumNextBid, formatUSD, displayName, formatQty } from "@/lib/format"
import { chainConfig } from "@/lib/config"
import type {
  Auction, Bid, BuyerStats, CreateAuctionRequest, CreateCropRequest, CreateOfferRequest, Crop, CropFilters,
  CropStatus, FarmerStats, MarketStats, Notification, Offer, Order, PaginatedResponse, PaginationParams,
  PublicUser, SeriesPoint, User, UserRole,
} from "@/lib/types/database"

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}
const bad = (message: string) => new ApiError(400, message)
const conflict = (message: string) => new ApiError(409, message)
const forbidden = (message = "You don't have permission to do that.") => new ApiError(403, message)
const notFound = (what: string) => new ApiError(404, `${what} not found.`)

const store = () => getStore()
const round2 = (n: number) => Math.round(n * 100) / 100
const HOUR = 3_600_000

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export function toPublicUser(u: User): PublicUser {
  return { id: u.id, wallet_address: u.wallet_address, display_name: u.display_name, location: u.location, verified: u.verified, role: u.role }
}

export async function getUserByAddress(address: string) {
  const [user] = await store().list("users", { wallet_address: address.toLowerCase() })
  return user ?? null
}

export async function findOrCreateUser(address: string) {
  const existing = await getUserByAddress(address)
  if (existing) return existing
  try {
    return await store().insert("users", {
      wallet_address: address.toLowerCase(),
      role: "buyer",
      display_name: null,
      email: null,
      location: null,
      bio: null,
      verified: false,
    })
  } catch (e) {
    // Two first sign-ins racing: the unique wallet index lets one win; return that user.
    const winner = await getUserByAddress(address)
    if (winner) return winner
    throw e
  }
}

export async function updateProfile(user: User, patch: { role?: UserRole; display_name?: string | null; location?: string | null; bio?: string | null }) {
  const clean: Partial<User> = {}
  if (patch.role !== undefined) {
    if (!["farmer", "buyer"].includes(patch.role)) throw bad("Role must be farmer or buyer.")
    clean.role = patch.role
  }
  if (patch.display_name !== undefined) clean.display_name = patch.display_name?.trim().slice(0, 60) || null
  if (patch.location !== undefined) clean.location = patch.location?.trim().slice(0, 80) || null
  if (patch.bio !== undefined) clean.bio = patch.bio?.trim().slice(0, 400) || null
  return store().update("users", user.id, clean)
}

async function usersById(ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter(Boolean) as string[])]
  if (!unique.length) return new Map<string, PublicUser>()
  const rows = await store().list("users", { id: unique })
  return new Map(rows.map((u) => [u.id, toPublicUser(u)]))
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

async function notify(userId: string | null | undefined, n: { type: string; title: string; message: string; link?: string }) {
  if (!userId) return
  await store().insert("notifications", { user_id: userId, read: false, link: n.link ?? null, type: n.type, title: n.title, message: n.message })
}

export async function listNotifications(user: User, limit = 30) {
  const rows = await store().list("notifications", { user_id: user.id })
  return rows.sort(byNewest).slice(0, limit)
}

export async function markNotificationsRead(user: User, ids?: string[]) {
  const rows = await store().list("notifications", { user_id: user.id, read: false })
  for (const n of rows) if (!ids || ids.includes(n.id)) await store().update("notifications", n.id, { read: true })
}

const byNewest = (a: { created_at: string }, b: { created_at: string }) => b.created_at.localeCompare(a.created_at)

// ---------------------------------------------------------------------------
// Lazy housekeeping: settle finished auctions, expire stale offers
// ---------------------------------------------------------------------------

let housekeepingAt = 0
async function housekeeping(force = false) {
  if (!force && Date.now() - housekeepingAt < 5_000) return
  housekeepingAt = Date.now()
  const now = new Date().toISOString()
  const active = await store().list("auctions", { status: "active" })
  for (const a of active) if (a.end_time <= now) await settleAuction(a)
  const pending = await store().list("offers", { status: "pending" })
  for (const o of pending) if (o.expires_at && o.expires_at <= now) await store().update("offers", o.id, { status: "expired" })
}

async function settleAuction(auction: Auction) {
  // Claim the auction atomically; a concurrent request that loses the race does nothing.
  const claimed = await store().updateIf("auctions", auction.id, { status: "active" }, { status: "ended" })
  if (!claimed) return
  auction = claimed
  const crop = await store().get("crops", auction.crop_id)
  if (!crop) return
  const reserveMet = auction.highest_bidder_id && (auction.current_highest_bid ?? 0) >= (auction.reserve_price ?? 0)
  if (reserveMet) {
    const amount = auction.current_highest_bid!
    const order = await store().insert("orders", {
      crop_id: crop.id,
      buyer_id: auction.highest_bidder_id!,
      farmer_id: crop.farmer_id,
      auction_id: auction.id,
      offer_id: null,
      source: "auction",
      quantity: crop.quantity,
      unit_price: round2(amount / crop.quantity),
      total_amount: amount,
      payment_status: "pending",
      delivery_status: "pending",
      delivery_address: null,
      transaction_hash: null,
    })
    await store().update("auctions", auction.id, { winner_id: auction.highest_bidder_id, settled_order_id: order.id })
    await store().update("crops", crop.id, { status: "sold" })
    await notify(auction.highest_bidder_id, {
      type: "auction_won",
      title: `You won ${crop.title}`,
      message: auction.blockchain_id
        ? `Winning bid ${formatUSD(amount)} is escrowed on-chain. Finalize to release the certificate.`
        : `Winning bid ${formatUSD(amount)}. Arrange payment with the farmer to complete the order.`,
      link: "/orders",
    })
    await notify(crop.farmer_id, { type: "auction_ended", title: `${crop.title} sold at auction`, message: `Closed at ${formatUSD(amount)} after ${auction.total_bids} bids.`, link: "/orders?tab=sales" })
  } else {
    await store().update("crops", crop.id, { status: "active" })
    await notify(crop.farmer_id, {
      type: "auction_ended",
      title: `Auction closed without a sale`,
      message: auction.highest_bidder_id ? `${crop.title} ended below your reserve. The lot is back on the market.` : `${crop.title} received no bids. The lot is back on the market.`,
      link: `/crop/${crop.id}`,
    })
  }
}

// ---------------------------------------------------------------------------
// Crops
// ---------------------------------------------------------------------------

async function hydrateCrops(crops: Crop[]): Promise<Crop[]> {
  if (!crops.length) return []
  const ids = crops.map((c) => c.id)
  const [farmers, auctions, offers] = await Promise.all([
    usersById(crops.map((c) => c.farmer_id)),
    store().list("auctions", { crop_id: ids, status: "active" }),
    store().list("offers", { crop_id: ids, status: "pending" }),
  ])
  return crops.map((c) => ({
    ...c,
    farmer: farmers.get(c.farmer_id),
    current_auction: auctions.find((a) => a.crop_id === c.id) ?? null,
    pending_offers: offers.filter((o) => o.crop_id === c.id).length,
  }))
}

/** Unit price used for sorting/filtering: live bid per unit, else asking price. */
function effectiveUnitPrice(c: Crop) {
  if (c.current_auction) return minimumNextBid(c.current_auction) / c.quantity
  return c.buyout_price ?? c.starting_price ?? c.minimum_price ?? 0
}

export async function listCrops(filters: CropFilters = {}, pagination: PaginationParams = {}): Promise<PaginatedResponse<Crop>> {
  await housekeeping()
  const { page = 1, limit = 12, sort = "newest" } = pagination
  const statuses: CropStatus[] = filters.status?.length ? filters.status : ["active", "auction"]
  let rows = await store().list("crops", { status: statuses, ...(filters.farmer_id ? { farmer_id: filters.farmer_id } : {}) })

  if (filters.crop_type) rows = rows.filter((c) => c.crop_type === filters.crop_type)
  if (filters.organic_certified !== undefined) rows = rows.filter((c) => c.organic_certified === filters.organic_certified)
  if (filters.location) rows = rows.filter((c) => c.location?.toLowerCase().includes(filters.location!.toLowerCase()))

  let hydrated = await hydrateCrops(rows)
  if (filters.q) {
    const q = filters.q.toLowerCase()
    hydrated = hydrated.filter((c) =>
      [c.title, c.description, c.variety, c.location, c.crop_type, c.farmer?.display_name].some((f) => f?.toLowerCase().includes(q)),
    )
  }
  if (filters.min_price != null) hydrated = hydrated.filter((c) => effectiveUnitPrice(c) >= filters.min_price!)
  if (filters.max_price != null) hydrated = hydrated.filter((c) => effectiveUnitPrice(c) <= filters.max_price!)

  const sorters: Record<string, (a: Crop, b: Crop) => number> = {
    newest: byNewest,
    price_asc: (a, b) => effectiveUnitPrice(a) - effectiveUnitPrice(b),
    price_desc: (a, b) => effectiveUnitPrice(b) - effectiveUnitPrice(a),
    ending_soon: (a, b) => (a.current_auction?.end_time ?? "9999").localeCompare(b.current_auction?.end_time ?? "9999"),
  }
  hydrated.sort(sorters[sort] ?? byNewest)

  const total = hydrated.length
  const start = (page - 1) * limit
  return {
    data: hydrated.slice(start, start + limit),
    pagination: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)), has_next: start + limit < total, has_prev: page > 1 },
  }
}

export async function getCrop(id: string) {
  await housekeeping()
  const crop = await store().get("crops", id)
  if (!crop) throw notFound("Lot")
  const [hydrated] = await hydrateCrops([crop])
  return hydrated
}

export async function farmerCrops(user: User) {
  await housekeeping()
  const rows = await store().list("crops", { farmer_id: user.id })
  return (await hydrateCrops(rows)).sort(byNewest)
}

function num(value: unknown, field: string, { required = false, min = 0, positive = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) throw bad(`${field} is required.`)
    return null
  }
  const n = Number(value)
  if (!Number.isFinite(n)) throw bad(`${field} must be a number.`)
  if (positive ? n <= 0 : n < min) throw bad(`${field} must be ${positive ? "greater than 0" : `at least ${min}`}.`)
  return n
}

export async function createCrop(user: User, req: CreateCropRequest) {
  if (user.role !== "farmer") throw forbidden("Switch to the farmer role to register lots.")
  const title = req.title?.trim()
  const description = req.description?.trim()
  if (!title || title.length < 3) throw bad("Give the lot a title of at least 3 characters.")
  if (!description || description.length < 10) throw bad("Add a description of at least 10 characters.")
  if (!req.crop_type) throw bad("Choose a crop type.")
  const quantity = num(req.quantity, "Quantity", { required: true, positive: true })!
  const minimum = num(req.minimum_price, "Minimum price", { required: true, positive: true })!
  const starting = num(req.starting_price, "Starting price") ?? minimum
  const buyout = num(req.buyout_price, "Buy-now price")
  if (starting < minimum) throw bad("Starting price can't be below the minimum price.")
  if (buyout != null && buyout < starting) throw bad("Buy-now price should be at or above the starting price.")
  const moisture = num(req.moisture_content, "Moisture content")
  if (moisture != null && moisture > 100) throw bad("Moisture content is a percentage (0–100).")

  let harvest: string | null = null
  if (req.harvest_date) {
    const v = DateValidator.validateHarvestDate(req.harvest_date)
    if (!v.isValid) throw bad(v.error ?? "Invalid harvest date.")
    harvest = v.sanitizedValue
  }

  const created_at = new Date().toISOString()
  const base = {
    farmer_id: user.id,
    title: title.slice(0, 120),
    description: description.slice(0, 4000),
    crop_type: req.crop_type,
    variety: req.variety?.trim() || null,
    quantity,
    unit: req.unit || "kg",
    harvest_date: harvest,
    location: req.location?.trim() || user.location || null,
    organic_certified: Boolean(req.organic_certified),
    quality_grade: req.quality_grade || null,
    moisture_content: moisture,
    storage_conditions: req.storage_conditions?.trim() || null,
    minimum_price: minimum,
    starting_price: starting,
    buyout_price: buyout,
    status: "active" as const,
    images: (req.images ?? []).filter((u) => typeof u === "string").slice(0, 8),
    created_at,
  }
  return store().insert("crops", {
    ...base,
    content_hash: computeContentHash(base, user.wallet_address),
    metadata_uri: null,
    nft_token_id: null,
    nft_contract: null,
    nft_minted: false,
    nft_transaction_hash: null,
  })
}

export async function setCropMetadataUri(cropId: string, uri: string) {
  return store().update("crops", cropId, { metadata_uri: uri })
}

export async function recordMint(user: User, cropId: string, body: { token_id: number; transaction_hash: string; metadata_uri?: string }) {
  const crop = await store().get("crops", cropId)
  if (!crop) throw notFound("Lot")
  if (crop.farmer_id !== user.id) throw forbidden()
  if (crop.nft_minted) throw bad("This lot already has an on-chain certificate.")
  const tokenId = num(body.token_id, "Token ID", { required: true, positive: true })!
  if (!/^0x[0-9a-fA-F]{64}$/.test(body.transaction_hash ?? "")) throw bad("A valid transaction hash is required.")
  return store().update("crops", cropId, {
    nft_minted: true,
    nft_token_id: tokenId,
    nft_transaction_hash: body.transaction_hash,
    nft_contract: chainConfig.nftContract ?? null,
    ...(body.metadata_uri ? { metadata_uri: body.metadata_uri } : {}),
  })
}

export async function setListing(user: User, cropId: string, action: "delist" | "relist") {
  const crop = await store().get("crops", cropId)
  if (!crop) throw notFound("Lot")
  if (crop.farmer_id !== user.id) throw forbidden()
  if (action === "delist") {
    if (crop.status !== "active") throw bad("Only lots that are listed (not in auction or sold) can be withdrawn.")
    const pending = await store().list("offers", { crop_id: crop.id, status: "pending" })
    for (const o of pending) {
      await store().update("offers", o.id, { status: "rejected", response_message: "Lot withdrawn from the market." })
      await notify(o.buyer_id, { type: "offer", title: "Offer closed", message: `${crop.title} was withdrawn by the farmer.`, link: "/offers?tab=sent" })
    }
    return store().update("crops", crop.id, { status: "expired" })
  }
  if (crop.status !== "expired") throw bad("Only withdrawn lots can be relisted.")
  return store().update("crops", crop.id, { status: "active" })
}

// ---------------------------------------------------------------------------
// Auctions & bids
// ---------------------------------------------------------------------------

export async function createAuction(user: User, req: CreateAuctionRequest) {
  const crop = await store().get("crops", req.crop_id)
  if (!crop) throw notFound("Lot")
  if (crop.farmer_id !== user.id) throw forbidden("Only the farmer who listed this lot can auction it.")
  if (crop.status !== "active") throw bad("Only listed lots can go to auction.")
  const starting = num(req.starting_price, "Starting price", { required: true, positive: true })!
  const reserve = num(req.reserve_price, "Reserve price")
  const increment = num(req.bid_increment, "Bid increment") ?? Math.max(1, Math.round(starting * 0.01))
  const hours = num(req.duration_hours, "Duration", { required: true, positive: true })!
  if (hours < 1 || hours > 24 * 30) throw bad("Auctions run between 1 hour and 30 days.")
  if (crop.minimum_price && starting < crop.minimum_price * crop.quantity) {
    throw bad(`Starting price must cover your minimum of ${formatUSD(crop.minimum_price * crop.quantity)} for the lot.`)
  }
  if (reserve != null && reserve < starting) throw bad("Reserve price can't be below the starting price.")
  if (crop.nft_minted && chainConfig.enabled && !req.blockchain_id) {
    throw bad("This lot is certified on-chain, so its auction must be created on-chain too.")
  }

  // Claim the lot atomically so a simultaneous buy-now or second auction can't also take it.
  if (!(await store().updateIf("crops", crop.id, { status: "active" }, { status: "auction" }))) throw conflict("This lot just changed state. Refresh and try again.")

  const pending = await store().list("offers", { crop_id: crop.id, status: "pending" })
  for (const o of pending) {
    await store().update("offers", o.id, { status: "rejected", response_message: "The farmer moved this lot to auction." })
    await notify(o.buyer_id, { type: "offer", title: "Lot moved to auction", message: `${crop.title} is now being auctioned — place a bid instead.`, link: `/crop/${crop.id}` })
  }

  const start = new Date()
  const auction = await store().insert("auctions", {
    crop_id: crop.id,
    starting_price: starting,
    reserve_price: reserve,
    bid_increment: increment,
    current_highest_bid: null,
    highest_bidder_id: null,
    start_time: start.toISOString(),
    end_time: new Date(start.getTime() + hours * HOUR).toISOString(),
    status: "active",
    total_bids: 0,
    blockchain_id: req.blockchain_id ?? null,
    transaction_hash: req.transaction_hash ?? null,
    winner_id: null,
    settled_order_id: null,
    chain_finalized: false,
  })
  return auction
}

export async function listAuctions(status: "active" | "ended" = "active") {
  await housekeeping()
  const auctions = await store().list("auctions", { status })
  const crops = await store().list("crops", { id: auctions.map((a) => a.crop_id) })
  const hydratedCrops = await hydrateCrops(crops)
  const bidders = await usersById(auctions.map((a) => a.highest_bidder_id))
  return auctions
    .map((a) => ({ ...a, crop: hydratedCrops.find((c) => c.id === a.crop_id), highest_bidder: a.highest_bidder_id ? bidders.get(a.highest_bidder_id) ?? null : null }))
    .sort((a, b) => (status === "active" ? a.end_time.localeCompare(b.end_time) : b.end_time.localeCompare(a.end_time)))
}

export async function getAuction(id: string) {
  await housekeeping()
  const auction = await store().get("auctions", id)
  if (!auction) throw notFound("Auction")
  const bids = (await store().list("bids", { auction_id: id })).sort((a, b) => b.amount - a.amount || a.bid_time.localeCompare(b.bid_time))
  const users = await usersById([...bids.map((b) => b.bidder_id), auction.highest_bidder_id])
  return {
    auction: { ...auction, highest_bidder: auction.highest_bidder_id ? users.get(auction.highest_bidder_id) ?? null : null },
    bids: bids.map((b) => ({ ...b, bidder: users.get(b.bidder_id) })),
  }
}

export async function placeBid(user: User, auctionId: string, body: { amount: number; transaction_hash?: string | null }) {
  await housekeeping(true)
  const auction = await store().get("auctions", auctionId)
  if (!auction) throw notFound("Auction")
  const crop = await store().get("crops", auction.crop_id)
  if (!crop) throw notFound("Lot")
  if (auction.status !== "active" || auction.end_time <= new Date().toISOString()) throw bad("This auction has closed.")
  if (crop.farmer_id === user.id) throw forbidden("You can't bid on your own lot.")
  const amount = num(body.amount, "Bid amount", { required: true, positive: true })!
  const min = minimumNextBid(auction)
  if (amount + 1e-9 < min) throw bad(`Bids must be at least ${formatUSD(min)}.`)
  if (auction.blockchain_id && chainConfig.enabled && !body.transaction_hash) throw bad("This auction settles on-chain; submit the bid from your wallet.")

  const previousLeader = auction.highest_bidder_id
  const now = new Date()
  // Anti-sniping: a bid in the final 10 minutes extends the auction (mirrors the contract).
  const msLeft = new Date(auction.end_time).getTime() - now.getTime()
  const end_time = msLeft < 10 * 60_000 ? new Date(now.getTime() + 10 * 60_000).toISOString() : auction.end_time

  // Compare-and-set on the current top bid: if another bid landed since we read it, this one loses.
  const won = await store().updateIf(
    "auctions",
    auctionId,
    { status: "active", current_highest_bid: auction.current_highest_bid ?? null, total_bids: auction.total_bids },
    { current_highest_bid: amount, highest_bidder_id: user.id, total_bids: auction.total_bids + 1, end_time },
  )
  if (!won) throw conflict("Another bid just landed. Refresh to see the new minimum and try again.")

  const prior = await store().list("bids", { auction_id: auctionId, is_winning: true })
  for (const b of prior) await store().update("bids", b.id, { is_winning: false })

  const bid = await store().insert("bids", {
    auction_id: auctionId,
    bidder_id: user.id,
    amount,
    is_winning: true,
    bid_time: now.toISOString(),
    transaction_hash: body.transaction_hash ?? null,
  })

  if (previousLeader && previousLeader !== user.id) {
    await notify(previousLeader, { type: "outbid", title: "You've been outbid", message: `${crop.title} is now at ${formatUSD(amount)}.`, link: `/crop/${crop.id}` })
  }
  await notify(crop.farmer_id, { type: "bid", title: `New bid on ${crop.title}`, message: `${displayName(user)} bid ${formatUSD(amount)}.`, link: `/crop/${crop.id}` })
  return bid
}

export async function cancelAuction(user: User, auctionId: string) {
  const auction = await store().get("auctions", auctionId)
  if (!auction) throw notFound("Auction")
  const crop = await store().get("crops", auction.crop_id)
  if (!crop || crop.farmer_id !== user.id) throw forbidden()
  if (auction.status !== "active") throw bad("This auction is already closed.")
  if (auction.total_bids > 0) throw bad("Auctions with bids can't be cancelled — bidders are relying on them.")
  if (auction.blockchain_id) throw bad("On-chain auctions run to completion; finalize it once it ends.")
  await store().update("auctions", auctionId, { status: "cancelled" })
  return store().update("crops", crop.id, { status: "active" })
}

/** Records the on-chain finalizeAuction tx; marks the resulting order as paid. */
export async function recordAuctionFinalized(user: User, auctionId: string, transactionHash: string) {
  await housekeeping(true)
  const auction = await store().get("auctions", auctionId)
  if (!auction) throw notFound("Auction")
  if (!auction.blockchain_id) throw bad("This auction is not on-chain.")
  if (auction.status === "active") throw bad("The auction hasn't ended yet.")
  if (!/^0x[0-9a-fA-F]{64}$/.test(transactionHash)) throw bad("A valid transaction hash is required.")
  await store().update("auctions", auctionId, { chain_finalized: true })
  if (auction.settled_order_id) {
    await store().update("orders", auction.settled_order_id, { payment_status: "paid", transaction_hash: transactionHash })
  }
  return store().get("auctions", auctionId)
}

export async function userBids(user: User) {
  await housekeeping()
  const bids = await store().list("bids", { bidder_id: user.id })
  const auctionIds = [...new Set(bids.map((b) => b.auction_id))]
  const auctions = await store().list("auctions", { id: auctionIds })
  const crops = await hydrateCrops(await store().list("crops", { id: auctions.map((a) => a.crop_id) }))
  // One row per auction: the user's best bid, with its standing.
  return auctionIds
    .map((aid) => {
      const mine = bids.filter((b) => b.auction_id === aid).sort((a, b) => b.amount - a.amount)
      const auction = auctions.find((a) => a.id === aid)!
      const leading = auction.highest_bidder_id === user.id
      const standing =
        auction.status === "active" ? (leading ? "leading" : "outbid") : auction.winner_id === user.id ? "won" : "lost"
      return { ...mine[0], bid_count: mine.length, standing, auction: { ...auction, crop: crops.find((c) => c.id === auction.crop_id) } }
    })
    .sort((a, b) => b.bid_time.localeCompare(a.bid_time))
}

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

export async function createOffer(user: User, req: CreateOfferRequest) {
  await housekeeping()
  const crop = await store().get("crops", req.crop_id)
  if (!crop) throw notFound("Lot")
  if (crop.farmer_id === user.id) throw forbidden("You can't make an offer on your own lot.")
  if (crop.status !== "active") throw bad(crop.status === "auction" ? "This lot is in auction — place a bid instead." : "This lot isn't accepting offers.")
  const quantity = num(req.quantity, "Quantity", { required: true, positive: true })!
  const ppu = num(req.price_per_unit, "Price per unit", { required: true, positive: true })!
  if (quantity > crop.quantity) throw bad(`Only ${formatQty(crop.quantity)} ${crop.unit} available.`)
  // A certified lot is one NFT; splitting it off-chain would desync the on-chain price and owner.
  if (crop.nft_minted && quantity !== crop.quantity) throw bad(`This lot is certified on-chain and trades whole — offer for all ${formatQty(crop.quantity)} ${crop.unit}.`)
  const hours = num(req.expires_in_hours, "Expiry") ?? 72
  const offer = await store().insert("offers", {
    crop_id: crop.id,
    buyer_id: user.id,
    quantity,
    price_per_unit: ppu,
    total_amount: round2(quantity * ppu),
    message: req.message?.trim().slice(0, 600) || null,
    response_message: null,
    status: "pending",
    expires_at: new Date(Date.now() + Math.min(hours, 24 * 14) * HOUR).toISOString(),
  })
  await notify(crop.farmer_id, {
    type: "offer",
    title: `New offer on ${crop.title}`,
    message: `${displayName(user)} offered ${formatUSD(ppu, { cents: true })}/${crop.unit} for ${formatQty(quantity)} ${crop.unit}.`,
    link: "/offers",
  })
  return offer
}

async function hydrateOffers(offers: Offer[]) {
  const crops = await hydrateCrops(await store().list("crops", { id: offers.map((o) => o.crop_id) }))
  const buyers = await usersById(offers.map((o) => o.buyer_id))
  return offers.map((o) => ({ ...o, crop: crops.find((c) => c.id === o.crop_id), buyer: buyers.get(o.buyer_id) })).sort(byNewest)
}

export async function offersReceived(user: User) {
  await housekeeping()
  const crops = await store().list("crops", { farmer_id: user.id })
  if (!crops.length) return []
  return hydrateOffers(await store().list("offers", { crop_id: crops.map((c) => c.id) }))
}

export async function offersSent(user: User) {
  await housekeeping()
  return hydrateOffers(await store().list("offers", { buyer_id: user.id }))
}

export async function cropOffers(cropId: string, viewer: User | null) {
  const crop = await store().get("crops", cropId)
  if (!crop) throw notFound("Lot")
  const offers = await store().list("offers", { crop_id: cropId })
  const visible = viewer && viewer.id === crop.farmer_id ? offers : offers.filter((o) => viewer && o.buyer_id === viewer.id)
  return hydrateOffers(visible)
}

export async function respondToOffer(user: User, offerId: string, body: { action: "accept" | "reject" | "withdraw"; message?: string }) {
  await housekeeping(true)
  const offer = await store().get("offers", offerId)
  if (!offer) throw notFound("Offer")
  const crop = await store().get("crops", offer.crop_id)
  if (!crop) throw notFound("Lot")
  if (offer.status !== "pending") throw bad(`This offer is already ${offer.status}.`)
  const message = body.message?.trim().slice(0, 600) || null

  if (body.action === "withdraw") {
    if (offer.buyer_id !== user.id) throw forbidden()
    return store().update("offers", offerId, { status: "withdrawn" })
  }
  if (crop.farmer_id !== user.id) throw forbidden("Only the farmer can respond to this offer.")

  if (body.action === "reject") {
    const updated = await store().update("offers", offerId, { status: "rejected", response_message: message })
    await notify(offer.buyer_id, { type: "offer", title: "Offer declined", message: `${crop.title}: ${message ?? "The farmer declined your offer."}`, link: "/offers?tab=sent" })
    return updated
  }

  if (body.action !== "accept") throw bad("Unknown action.")
  if (crop.status !== "active") throw bad("This lot is no longer available for offers.")
  if (offer.quantity > crop.quantity + 1e-9) throw bad(`Only ${formatQty(crop.quantity)} ${crop.unit} left — less than this offer.`)

  // Reserve the quantity first (compare-and-set), then mark the offer accepted.
  const remaining = round2(crop.quantity - offer.quantity)
  const reserved = await store().updateIf("crops", crop.id, { status: "active", quantity: crop.quantity }, remaining <= 0 ? { quantity: 0, status: "sold" } : { quantity: remaining })
  if (!reserved) throw conflict("This lot changed while you were reviewing. Refresh and try again.")
  const updated = await store().updateIf("offers", offerId, { status: "pending" }, { status: "accepted", response_message: message })
  if (!updated) {
    await store().update("crops", crop.id, { quantity: crop.quantity, status: crop.status })
    throw conflict("This offer was just withdrawn or answered.")
  }
  await store().insert("orders", {
    crop_id: crop.id,
    buyer_id: offer.buyer_id,
    farmer_id: crop.farmer_id,
    auction_id: null,
    offer_id: offer.id,
    source: "offer",
    quantity: offer.quantity,
    unit_price: offer.price_per_unit,
    total_amount: offer.total_amount,
    payment_status: "pending",
    delivery_status: "pending",
    delivery_address: null,
    transaction_hash: null,
  })
  await notify(offer.buyer_id, { type: "offer_accepted", title: "Offer accepted", message: `${crop.title}: ${formatQty(offer.quantity)} ${crop.unit} for ${formatUSD(offer.total_amount)}. An order has been opened.`, link: "/orders" })
  if (remaining <= 0) {
    const others = await store().list("offers", { crop_id: crop.id, status: "pending" })
    for (const o of others) {
      await store().update("offers", o.id, { status: "rejected", response_message: "The lot sold out." })
      await notify(o.buyer_id, { type: "offer", title: "Lot sold out", message: `${crop.title} has sold out.`, link: "/offers?tab=sent" })
    }
  }
  return updated
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export async function buyNow(user: User, cropId: string, body: { transaction_hash?: string | null; delivery_address?: string }) {
  await housekeeping(true)
  const crop = await store().get("crops", cropId)
  if (!crop) throw notFound("Lot")
  if (crop.farmer_id === user.id) throw forbidden("You can't buy your own lot.")
  if (crop.status !== "active") throw bad("This lot is no longer available to buy now.")
  if (!crop.buyout_price) throw bad("This lot doesn't have a buy-now price.")
  if (crop.nft_minted && chainConfig.enabled && !body.transaction_hash) throw bad("This lot is certified on-chain; complete the purchase from your wallet.")

  // Two buyers clicking at once: only the one whose compare-and-set succeeds gets the lot.
  if (!(await store().updateIf("crops", crop.id, { status: "active", quantity: crop.quantity }, { status: "sold" }))) {
    throw conflict("Someone else just bought or changed this lot.")
  }
  const total = round2(crop.buyout_price * crop.quantity)
  const order = await store().insert("orders", {
    crop_id: crop.id,
    buyer_id: user.id,
    farmer_id: crop.farmer_id,
    auction_id: null,
    offer_id: null,
    source: "buy_now",
    quantity: crop.quantity,
    unit_price: crop.buyout_price,
    total_amount: total,
    payment_status: body.transaction_hash ? "paid" : "pending",
    delivery_status: "pending",
    delivery_address: body.delivery_address?.trim() || user.location || null,
    transaction_hash: body.transaction_hash ?? null,
  })
  const pending = await store().list("offers", { crop_id: crop.id, status: "pending" })
  for (const o of pending) {
    await store().update("offers", o.id, { status: "rejected", response_message: "The lot was bought outright." })
    await notify(o.buyer_id, { type: "offer", title: "Lot sold", message: `${crop.title} was bought outright.`, link: "/offers?tab=sent" })
  }
  await notify(crop.farmer_id, { type: "order", title: `${crop.title} sold`, message: `${displayName(user)} bought the full lot for ${formatUSD(total)}.`, link: "/orders?tab=sales" })
  return order
}

async function hydrateOrders(orders: Order[]) {
  const crops = await store().list("crops", { id: orders.map((o) => o.crop_id) })
  const users = await usersById(orders.flatMap((o) => [o.buyer_id, o.farmer_id]))
  return orders.map((o) => ({ ...o, crop: crops.find((c) => c.id === o.crop_id), buyer: users.get(o.buyer_id), farmer: users.get(o.farmer_id) })).sort(byNewest)
}

export async function listOrders(user: User, as: "buyer" | "farmer") {
  await housekeeping()
  return hydrateOrders(await store().list("orders", as === "buyer" ? { buyer_id: user.id } : { farmer_id: user.id }))
}

export type OrderAction = "confirm_payment" | "ship" | "deliver" | "cancel"

async function guarded<T>(p: Promise<T | null>) {
  const r = await p
  if (!r) throw conflict("This order was just updated. Refresh to see its current status.")
  return r
}

export async function updateOrder(user: User, orderId: string, action: OrderAction) {
  const order = await store().get("orders", orderId)
  if (!order) throw notFound("Order")
  const isFarmer = order.farmer_id === user.id
  const isBuyer = order.buyer_id === user.id
  if (!isFarmer && !isBuyer) throw forbidden()
  const crop = await store().get("crops", order.crop_id)
  const title = crop?.title ?? "your lot"

  switch (action) {
    case "confirm_payment":
      if (!isFarmer) throw forbidden("Only the farmer can confirm payment was received.")
      if (order.payment_status !== "pending") throw bad("Payment is already settled.")
      await notify(order.buyer_id, { type: "order", title: "Payment confirmed", message: `The farmer confirmed your payment for ${title}.`, link: "/orders" })
      return guarded(store().updateIf("orders", orderId, { payment_status: "pending" }, { payment_status: "paid" }))
    case "ship":
      if (!isFarmer) throw forbidden("Only the farmer can mark an order shipped.")
      if (order.delivery_status !== "pending") throw bad("This order has already shipped.")
      if (order.payment_status !== "paid") throw bad("Confirm payment before shipping.")
      await notify(order.buyer_id, { type: "order", title: "Order shipped", message: `${title} is on its way.`, link: "/orders" })
      return guarded(store().updateIf("orders", orderId, { delivery_status: "pending", payment_status: "paid" }, { delivery_status: "shipped" }))
    case "deliver":
      if (!isBuyer) throw forbidden("Only the buyer can confirm delivery.")
      if (order.delivery_status !== "shipped") throw bad("This order hasn't shipped yet.")
      await notify(order.farmer_id, { type: "order", title: "Delivery confirmed", message: `The buyer received ${title}. Order complete.`, link: "/orders?tab=sales" })
      return guarded(store().updateIf("orders", orderId, { delivery_status: "shipped" }, { delivery_status: "delivered" }))
    case "cancel": {
      if (order.payment_status === "paid") throw bad("Paid orders can't be cancelled here — contact the counterparty for a refund.")
      if (order.delivery_status !== "pending") throw bad("Shipped orders can't be cancelled.")
      const updated = await guarded(store().updateIf("orders", orderId, { payment_status: "pending", delivery_status: "pending" }, { delivery_status: "cancelled", payment_status: "failed" }))
      if (crop) {
        // Return the goods to the market.
        const restoredQty = order.source === "offer" ? round2((crop.status === "sold" ? 0 : crop.quantity) + order.quantity) : crop.quantity
        await store().update("crops", crop.id, { status: "active", quantity: restoredQty })
      }
      await notify(isFarmer ? order.buyer_id : order.farmer_id, { type: "order", title: "Order cancelled", message: `The order for ${title} was cancelled.`, link: isFarmer ? "/orders" : "/orders?tab=sales" })
      return updated
    }
    default:
      throw bad("Unknown action.")
  }
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

function dailySeries(rows: { created_at: string; total_amount: number }[], days = 30): SeriesPoint[] {
  // Bucket by UTC calendar day, the same basis as the ISO timestamps being summed. (Local midnight
  // here pushed today's sales outside the window for any timezone east of UTC.)
  const out: SeriesPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    out.push({ date: new Date(Date.now() - i * 24 * HOUR).toISOString().slice(0, 10), value: 0 })
  }
  let running = 0
  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const first = out[0].date
  for (const r of sorted) if (r.created_at.slice(0, 10) < first) running += r.total_amount
  // Cumulative series reads better than spiky daily totals for a handful of large trades.
  return out.map((p) => {
    running += sorted.filter((r) => r.created_at.slice(0, 10) === p.date).reduce((s, r) => s + r.total_amount, 0)
    return { date: p.date, value: round2(running) }
  })
}

export async function farmerStats(user: User): Promise<FarmerStats> {
  await housekeeping()
  const crops = await store().list("crops", { farmer_id: user.id })
  const cropIds = crops.map((c) => c.id)
  const [offers, auctions, orders] = await Promise.all([
    cropIds.length ? store().list("offers", { crop_id: cropIds }) : Promise.resolve([] as Offer[]),
    cropIds.length ? store().list("auctions", { crop_id: cropIds }) : Promise.resolve([] as Auction[]),
    store().list("orders", { farmer_id: user.id }),
  ])
  const live = orders.filter((o) => o.delivery_status !== "cancelled")
  const settled = live.filter((o) => o.payment_status === "paid")
  const byType = new Map<string, number>()
  for (const o of live) {
    const t = crops.find((c) => c.id === o.crop_id)?.crop_type ?? "other"
    byType.set(t, (byType.get(t) ?? 0) + o.total_amount)
  }
  return {
    role: "farmer",
    lots: { total: crops.length, active: crops.filter((c) => c.status === "active").length, auction: crops.filter((c) => c.status === "auction").length, sold: crops.filter((c) => c.status === "sold").length },
    offers: { total: offers.length, pending: offers.filter((o) => o.status === "pending").length, accepted: offers.filter((o) => o.status === "accepted").length },
    auctions: { live: auctions.filter((a) => a.status === "active").length, total: auctions.length },
    revenue: { settled: round2(settled.reduce((s, o) => s + o.total_amount, 0)), pending: round2(live.filter((o) => o.payment_status === "pending").reduce((s, o) => s + o.total_amount, 0)), series: dailySeries(settled) },
    by_crop: [...byType.entries()].map(([crop_type, value]) => ({ crop_type, value: round2(value) })).sort((a, b) => b.value - a.value),
    orders_to_ship: live.filter((o) => o.delivery_status === "pending").length,
  }
}

export async function buyerStats(user: User): Promise<BuyerStats> {
  await housekeeping()
  const [bids, offers, orders] = await Promise.all([
    userBids(user),
    store().list("offers", { buyer_id: user.id }),
    store().list("orders", { buyer_id: user.id }),
  ])
  const live = orders.filter((o) => o.delivery_status !== "cancelled")
  const settled = live.filter((o) => o.payment_status === "paid")
  return {
    role: "buyer",
    bids: { total: bids.length, winning: bids.filter((b) => b.standing === "leading").length, won: bids.filter((b) => b.standing === "won").length },
    offers: { total: offers.length, pending: offers.filter((o) => o.status === "pending").length, accepted: offers.filter((o) => o.status === "accepted").length },
    orders: { total: live.length, in_transit: live.filter((o) => o.delivery_status === "shipped").length, delivered: live.filter((o) => o.delivery_status === "delivered").length },
    spending: { settled: round2(settled.reduce((s, o) => s + o.total_amount, 0)), pending: round2(live.filter((o) => o.payment_status === "pending").reduce((s, o) => s + o.total_amount, 0)), series: dailySeries(settled) },
  }
}

export async function marketStats(): Promise<MarketStats> {
  await housekeeping()
  const [crops, auctions, orders, farmers] = await Promise.all([
    store().list("crops", { status: ["active", "auction"] }),
    store().list("auctions", { status: "active" }),
    store().list("orders"),
    store().list("users", { role: "farmer" }),
  ])
  return {
    lots: crops.length,
    live_auctions: auctions.length,
    farmers: farmers.length,
    volume: round2(orders.filter((o) => o.delivery_status !== "cancelled").reduce((s, o) => s + o.total_amount, 0)),
    certified: (await store().list("crops")).filter((c) => c.content_hash).length,
  }
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export async function findCropForVerification(query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return null
  const direct = await store().get("crops", q).catch(() => null)
  if (direct) return direct
  const all = await store().list("crops")
  const serial = q.replace(/^s2s-/, "").replace(/-/g, "")
  return (
    all.find((c) => c.content_hash?.toLowerCase() === q) ??
    all.find((c) => c.nft_transaction_hash?.toLowerCase() === q) ??
    all.find((c) => /^\d+$/.test(q) && c.nft_token_id === Number(q)) ??
    all.find((c) => serial.length === 8 && c.content_hash?.toLowerCase().slice(2, 10) === serial) ??
    null
  )
}

export async function verifyCrop(crop: Crop) {
  const farmer = await store().get("users", crop.farmer_id)
  const computed = farmer ? computeContentHash(crop, farmer.wallet_address) : null
  return {
    crop: (await hydrateCrops([crop]))[0],
    farmer: farmer ? toPublicUser(farmer) : null,
    stored_hash: crop.content_hash ?? null,
    computed_hash: computed,
    intact: Boolean(computed && crop.content_hash && computed === crop.content_hash),
  }
}

export type { Notification }
