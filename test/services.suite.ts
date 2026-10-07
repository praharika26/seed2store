// Shared business-rule suite, run once per storage backend (see services.*.test.ts).
import { describe, it, expect, beforeAll } from "vitest"
import { Wallet } from "ethers"

type Services = typeof import("@/lib/server/services")
let svc: Services
let store: ReturnType<typeof import("@/lib/server/store").getStore>

const newUser = async (role: "farmer" | "buyer") => {
  const user = await svc.findOrCreateUser(Wallet.createRandom().address)
  return svc.updateProfile(user, { role, display_name: `${role}-${user.id.slice(0, 4)}` })
}

const baseCrop = {
  title: "Test Wheat Lot",
  description: "Clean, sortexed wheat for testing.",
  crop_type: "wheat",
  quantity: 10,
  unit: "ton",
  minimum_price: 300,
  starting_price: 310,
  buyout_price: 350,
}

export function runServiceSuite(backend: "local" | "mongodb") {
beforeAll(async () => {
  svc = await import("@/lib/server/services")
  store = (await import("@/lib/server/store")).getStore()
  expect(store.kind).toBe(backend)
})

describe("seeded store", () => {
  it("boots with demo data and live auctions", async () => {
    const stats = await svc.marketStats()
    expect(stats.lots).toBeGreaterThan(5)
    expect(stats.live_auctions).toBe(3)
    expect(stats.farmers).toBe(5)
  })

  it("seed certificates verify as intact", async () => {
    const crops = await store.list("crops")
    for (const crop of crops) expect((await svc.verifyCrop(crop)).intact).toBe(true)
  })
})

describe("crop registration", () => {
  it("rejects buyers and invalid pricing", async () => {
    const buyer = await newUser("buyer")
    await expect(svc.createCrop(buyer, baseCrop)).rejects.toThrow(/farmer role/)
    const farmer = await newUser("farmer")
    await expect(svc.createCrop(farmer, { ...baseCrop, starting_price: 100 })).rejects.toThrow(/below the minimum/)
    await expect(svc.createCrop(farmer, { ...baseCrop, harvest_date: "not-a-date" })).rejects.toThrow()
  })

  it("stores a content hash that detects tampering", async () => {
    const farmer = await newUser("farmer")
    const crop = await svc.createCrop(farmer, baseCrop)
    expect(crop.content_hash).toMatch(/^0x[0-9a-f]{64}$/)
    expect((await svc.verifyCrop(crop)).intact).toBe(true)
    const tampered = await store.update("crops", crop.id, { location: "Somewhere else" })
    expect((await svc.verifyCrop(tampered)).intact).toBe(false)
  })
})

describe("offers", () => {
  it("accepting an offer opens an order and reduces quantity", async () => {
    const farmer = await newUser("farmer")
    const buyer = await newUser("buyer")
    const crop = await svc.createCrop(farmer, baseCrop)
    await expect(svc.createOffer(farmer, { crop_id: crop.id, quantity: 1, price_per_unit: 320 })).rejects.toThrow(/own lot/)
    await expect(svc.createOffer(buyer, { crop_id: crop.id, quantity: 11, price_per_unit: 320 })).rejects.toThrow(/available/)

    const offer = await svc.createOffer(buyer, { crop_id: crop.id, quantity: 4, price_per_unit: 320 })
    await expect(svc.respondToOffer(buyer, offer.id, { action: "accept" })).rejects.toThrow(/Only the farmer/)
    await svc.respondToOffer(farmer, offer.id, { action: "accept" })

    const after = await store.get("crops", crop.id)
    expect(after?.quantity).toBe(6)
    const [order] = await svc.listOrders(buyer, "buyer")
    expect(order).toMatchObject({ source: "offer", quantity: 4, total_amount: 1280, payment_status: "pending" })
    const notes = await svc.listNotifications(buyer)
    expect(notes[0].title).toBe("Offer accepted")
  })
})

describe("buy now + order lifecycle", () => {
  it("buys the whole lot and walks payment → ship → deliver", async () => {
    const farmer = await newUser("farmer")
    const buyer = await newUser("buyer")
    const crop = await svc.createCrop(farmer, baseCrop)
    const order = await svc.buyNow(buyer, crop.id, {})
    expect(order.total_amount).toBe(3500)
    expect((await store.get("crops", crop.id))?.status).toBe("sold")
    await expect(svc.buyNow(buyer, crop.id, {})).rejects.toThrow(/no longer available/)

    await expect(svc.updateOrder(farmer, order.id, "ship")).rejects.toThrow(/Confirm payment/)
    await svc.updateOrder(farmer, order.id, "confirm_payment")
    await expect(svc.updateOrder(buyer, order.id, "deliver")).rejects.toThrow(/hasn't shipped/)
    await svc.updateOrder(farmer, order.id, "ship")
    const done = await svc.updateOrder(buyer, order.id, "deliver")
    expect(done.delivery_status).toBe("delivered")

    const stats = await svc.farmerStats(farmer)
    expect(stats.revenue.settled).toBe(3500)
  })

  it("cancelling an unpaid order returns the lot to market", async () => {
    const farmer = await newUser("farmer")
    const buyer = await newUser("buyer")
    const crop = await svc.createCrop(farmer, baseCrop)
    const order = await svc.buyNow(buyer, crop.id, {})
    await svc.updateOrder(buyer, order.id, "cancel")
    expect((await store.get("crops", crop.id))?.status).toBe("active")
  })
})

describe("auctions", () => {
  it("enforces bid increments, notifies the outbid bidder and settles to an order", async () => {
    const farmer = await newUser("farmer")
    const alice = await newUser("buyer")
    const bob = await newUser("buyer")
    const crop = await svc.createCrop(farmer, baseCrop)
    await expect(svc.createAuction(farmer, { crop_id: crop.id, starting_price: 100, duration_hours: 2 })).rejects.toThrow(/minimum/)
    const auction = await svc.createAuction(farmer, { crop_id: crop.id, starting_price: 3100, bid_increment: 50, duration_hours: 2 })
    expect((await store.get("crops", crop.id))?.status).toBe("auction")

    await expect(svc.placeBid(farmer, auction.id, { amount: 3200 })).rejects.toThrow(/own lot/)
    await expect(svc.placeBid(alice, auction.id, { amount: 3000 })).rejects.toThrow(/at least/)
    await svc.placeBid(alice, auction.id, { amount: 3100 })
    await expect(svc.placeBid(bob, auction.id, { amount: 3120 })).rejects.toThrow(/at least \$3,150/)
    await svc.placeBid(bob, auction.id, { amount: 3150 })
    expect((await svc.listNotifications(alice))[0].title).toBe("You've been outbid")
    await expect(svc.cancelAuction(farmer, auction.id)).rejects.toThrow(/with bids/)

    // Fast-forward: end the auction and let housekeeping settle it.
    await store.update("auctions", auction.id, { end_time: new Date(Date.now() - 1000).toISOString() })
    const { auction: settled } = await svc.getAuction(auction.id)
    // housekeeping is throttled; force a settle via placeBid's forced pass
    await expect(svc.placeBid(alice, auction.id, { amount: 9999 })).rejects.toThrow(/closed/)
    const final = await store.get("auctions", auction.id)
    expect(final?.status).toBe("ended")
    expect(final?.winner_id).toBe(bob.id)
    expect((await store.get("crops", crop.id))?.status).toBe("sold")
    const [order] = await svc.listOrders(bob, "buyer")
    expect(order).toMatchObject({ source: "auction", total_amount: 3150 })
    const standing = await svc.userBids(alice)
    expect(standing[0].standing).toBe("lost")
    expect(settled.id).toBe(auction.id)
  })
})

describe("concurrency (atomic compare-and-set)", () => {
  it("two simultaneous buy-nows: exactly one order", async () => {
    const farmer = await newUser("farmer")
    const [a, b] = [await newUser("buyer"), await newUser("buyer")]
    const crop = await svc.createCrop(farmer, baseCrop)
    const results = await Promise.allSettled([svc.buyNow(a, crop.id, {}), svc.buyNow(b, crop.id, {})])
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    expect(await store.list("orders", { crop_id: crop.id })).toHaveLength(1)
  })

  it("two simultaneous bids at the minimum: one wins, auction stays consistent", async () => {
    const farmer = await newUser("farmer")
    const [a, b] = [await newUser("buyer"), await newUser("buyer")]
    const crop = await svc.createCrop(farmer, baseCrop)
    const auction = await svc.createAuction(farmer, { crop_id: crop.id, starting_price: 3100, bid_increment: 50, duration_hours: 2 })
    const results = await Promise.allSettled([svc.placeBid(a, auction.id, { amount: 3100 }), svc.placeBid(b, auction.id, { amount: 3100 })])
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    const after = await store.get("auctions", auction.id)
    expect(after?.total_bids).toBe(1)
    expect((await store.list("bids", { auction_id: auction.id, is_winning: true }))).toHaveLength(1)
  })

  it("concurrent first sign-ins for one wallet create one user", async () => {
    const address = Wallet.createRandom().address
    const users = await Promise.all([svc.findOrCreateUser(address), svc.findOrCreateUser(address), svc.findOrCreateUser(address)])
    expect(new Set(users.map((u) => u.id)).size).toBe(1)
  })
})

describe("files and settings", () => {
  it("stores and reads back an upload", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3])
    const name = "a".repeat(64) + ".png"
    await store.putFile(name, "image/png", bytes)
    await store.putFile(name, "image/png", bytes) // idempotent
    const file = await store.getFile(name)
    expect(Array.from(file!.data)).toEqual(Array.from(bytes))
    expect(await store.getFile("b".repeat(64) + ".png")).toBeNull()
  })

  it("meta values are created once", async () => {
    const first = await store.getOrCreateMeta("test-key", () => "one")
    const second = await store.getOrCreateMeta("test-key", () => "two")
    expect([first, second]).toEqual(["one", "one"])
  })
})
}
