import { keccak256, toUtf8Bytes, getAddress } from "ethers"
import { computeContentHash } from "@/lib/certificate"
import type { Auction, Bid, Crop, Notification, Offer, Order, User } from "@/lib/types/database"

const HOUR = 3_600_000
const DAY = 24 * HOUR

const id = (label: string) => {
  const h = keccak256(toUtf8Bytes(`s2s-seed:${label}`)).slice(2)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}
const address = (label: string) => getAddress(`0x${keccak256(toUtf8Bytes(`wallet:${label}`)).slice(26)}`).toLowerCase()

/** Demo dataset with timestamps relative to "now", so a fresh install always looks alive. */
export function buildSeed() {
  const t = Date.now()
  const iso = (offsetMs: number) => new Date(t + offsetMs).toISOString()

  const user = (key: string, u: Partial<User> & Pick<User, "role" | "display_name">, ageDays: number): User => ({
    id: id(`user:${key}`),
    wallet_address: address(key),
    email: null,
    location: null,
    bio: null,
    verified: false,
    created_at: iso(-ageDays * DAY),
    updated_at: iso(-ageDays * DAY),
    ...u,
  })

  const farmers = {
    harjit: user("harjit", { role: "farmer", display_name: "Harjit Singh Farms", location: "Ludhiana, Punjab", verified: true, bio: "Third-generation wheat and basmati growers on 140 acres of canal-irrigated loam." }, 120),
    amara: user("amara", { role: "farmer", display_name: "Amara Coffee Collective", location: "Sidama, Ethiopia", verified: true, bio: "312 smallholders processing washed and natural lots at 1,900 m." }, 96),
    lucia: user("lucia", { role: "farmer", display_name: "Finca La Esperanza", location: "Huila, Colombia", verified: true, bio: "Shade-grown specialty coffee and cacao." }, 80),
    ravi: user("ravi", { role: "farmer", display_name: "Ravi Kumar", location: "Nashik, Maharashtra", verified: false, bio: "Onions, tomatoes and grapes for export markets." }, 45),
    meadow: user("meadow", { role: "farmer", display_name: "Meadowbrook Grain Co.", location: "Saskatchewan, Canada", verified: true, bio: "Non-GMO barley and pulses, lab-tested every lot." }, 150),
  }
  const buyers = {
    nordic: user("nordic", { role: "buyer", display_name: "Nordic Roasters", location: "Oslo, Norway" }, 70),
    deccan: user("deccan", { role: "buyer", display_name: "Deccan Foods Pvt Ltd", location: "Hyderabad, India" }, 60),
    brew: user("brew", { role: "buyer", display_name: "Brewline Malting", location: "Milwaukee, USA" }, 30),
  }
  const users = [...Object.values(farmers), ...Object.values(buyers)]

  type CropSeed = Omit<Crop, "id" | "created_at" | "updated_at" | "content_hash" | "metadata_uri" | "nft_token_id" | "nft_minted" | "images"> & { key: string; ageDays: number }
  const cropSeeds: CropSeed[] = [
    { key: "sharbati", farmer_id: farmers.harjit.id, title: "Sharbati Wheat, Golden Lot", description: "Bold, lustrous Sharbati grains from rain-fed fields in the Malwa belt. Naturally sweet with high gluten strength — prized by atta mills and artisan bakers. Machine-cleaned, sortexed and fumigation-free.", crop_type: "wheat", variety: "Sharbati MP-1", quantity: 18, unit: "ton", harvest_date: iso(-38 * DAY).slice(0, 10), location: "Ludhiana, Punjab", organic_certified: false, quality_grade: "A", moisture_content: 10.5, storage_conditions: "Hermetic silo bags, 18–22 °C, pest-free warehouse.", minimum_price: 290, starting_price: 305, buyout_price: 345, status: "auction", ageDays: 6 },
    { key: "basmati", farmer_id: farmers.harjit.id, title: "1121 Basmati, Aged 12 Months", description: "Extra-long grain 1121 Basmati aged a full year for maximum elongation (2.5×) and aroma. Single-origin, traceable to three fields.", crop_type: "rice", variety: "Pusa 1121", quantity: 9500, unit: "kg", harvest_date: iso(-370 * DAY).slice(0, 10), location: "Amritsar, Punjab", organic_certified: false, quality_grade: "A", moisture_content: 11.8, storage_conditions: "Jute bags on pallets, humidity-controlled godown.", minimum_price: 1.45, starting_price: 1.55, buyout_price: 1.8, status: "active", ageDays: 11 },
    { key: "yirga", farmer_id: farmers.amara.id, title: "Yirgacheffe Grade 1 Washed", description: "Floral, tea-like cup with bergamot and stone fruit. Cupping score 88.25. Washed at the Konga station, dried 14 days on raised beds.", crop_type: "coffee", variety: "Heirloom 74110", quantity: 1200, unit: "kg", harvest_date: iso(-75 * DAY).slice(0, 10), location: "Gedeo, Ethiopia", organic_certified: true, quality_grade: "A", moisture_content: 10.2, storage_conditions: "GrainPro liners inside jute, 60 kg bags.", minimum_price: 7.4, starting_price: 7.9, buyout_price: 9.2, status: "auction", ageDays: 4 },
    { key: "sidama", farmer_id: farmers.amara.id, title: "Sidama Natural, Bensa", description: "Sun-dried naturals with blueberry, cacao nib and winey acidity. 86.5 points. Ideal for espresso blends seeking fruit-forward character.", crop_type: "coffee", variety: "Heirloom", quantity: 2400, unit: "kg", harvest_date: iso(-60 * DAY).slice(0, 10), location: "Sidama, Ethiopia", organic_certified: true, quality_grade: "A", moisture_content: 10.8, storage_conditions: "GrainPro liners, ventilated warehouse.", minimum_price: 6.2, starting_price: 6.6, buyout_price: 7.5, status: "active", ageDays: 9 },
    { key: "huila", farmer_id: farmers.lucia.id, title: "Huila Pink Bourbon Microlot", description: "Rare Pink Bourbon with hibiscus, red grape and panela sweetness. Shade-grown at 1,750 m, fully traceable to a single hillside.", crop_type: "coffee", variety: "Pink Bourbon", quantity: 690, unit: "kg", harvest_date: iso(-50 * DAY).slice(0, 10), location: "Pitalito, Huila", organic_certified: true, quality_grade: "A", moisture_content: 10.4, storage_conditions: "Vacuum-packed 35 kg boxes.", minimum_price: 11.5, starting_price: 12.2, buyout_price: 14, status: "auction", ageDays: 2 },
    { key: "cacao", farmer_id: farmers.lucia.id, title: "Fine-Flavor Cacao Beans", description: "Fermented 6 days in cascading wooden boxes, sun-dried. Notes of red fruit and molasses — sought after by bean-to-bar makers.", crop_type: "other", variety: "Trinitario", quantity: 3, unit: "ton", harvest_date: iso(-40 * DAY).slice(0, 10), location: "Huila, Colombia", organic_certified: true, quality_grade: "B", moisture_content: 7, storage_conditions: "Jute sacks, raised pallets.", minimum_price: 6800, starting_price: 7100, buyout_price: 7900, status: "active", ageDays: 14 },
    { key: "onion", farmer_id: farmers.ravi.id, title: "Nashik Red Onions, Rabi", description: "Uniform 55–65 mm bulbs with tight skin and long shelf life. Cured 3 weeks; ideal for export to the Gulf and Southeast Asia.", crop_type: "onion", variety: "N-2-4-1", quantity: 24, unit: "ton", harvest_date: iso(-20 * DAY).slice(0, 10), location: "Lasalgaon, Nashik", organic_certified: false, quality_grade: "B", moisture_content: null, storage_conditions: "Ventilated onion chawl.", minimum_price: 265, starting_price: 280, buyout_price: 320, status: "active", ageDays: 3 },
    { key: "tomato", farmer_id: farmers.ravi.id, title: "Vine-Ripe Roma Tomatoes", description: "Firm, high-Brix Roma tomatoes harvested at breaker stage for processing and retail. Residue-tested.", crop_type: "tomato", variety: "Roma VF", quantity: 6500, unit: "kg", harvest_date: iso(-4 * DAY).slice(0, 10), location: "Nashik, Maharashtra", organic_certified: false, quality_grade: "B", moisture_content: null, storage_conditions: "Cold chain 10–12 °C, crates.", minimum_price: 0.38, starting_price: 0.42, buyout_price: 0.5, status: "active", ageDays: 1 },
    { key: "barley", farmer_id: farmers.meadow.id, title: "Two-Row Malting Barley", description: "AC Metcalfe malting barley with 98% germination energy and 11.2% protein. Lab certificate attached for every load.", crop_type: "barley", variety: "AC Metcalfe", quantity: 40, unit: "ton", harvest_date: iso(-55 * DAY).slice(0, 10), location: "Saskatoon, SK", organic_certified: false, quality_grade: "A", moisture_content: 12.5, storage_conditions: "Aerated steel bins with temperature cables.", minimum_price: 255, starting_price: 268, buyout_price: 300, status: "active", ageDays: 8 },
    { key: "lentil", farmer_id: farmers.meadow.id, title: "Organic Red Lentils", description: "Football-type red lentils, certified organic by Pro-Cert. Cleaned to 99.9% purity.", crop_type: "soybean", variety: "CDC Maxim", quantity: 20, unit: "ton", harvest_date: iso(-90 * DAY).slice(0, 10), location: "Regina, SK", organic_certified: true, quality_grade: "A", moisture_content: 13, storage_conditions: "Food-grade totes.", minimum_price: 820, starting_price: 860, buyout_price: 940, status: "sold", ageDays: 28 },
    { key: "durum", farmer_id: farmers.meadow.id, title: "Amber Durum for Pasta", description: "Hard amber durum, 14% protein, vitreous kernel count 88%. Perfect for semolina.", crop_type: "wheat", variety: "CDC Credence", quantity: 30, unit: "ton", harvest_date: iso(-100 * DAY).slice(0, 10), location: "Swift Current, SK", organic_certified: false, quality_grade: "A", moisture_content: 12.1, storage_conditions: "Aerated bins.", minimum_price: 330, starting_price: 345, buyout_price: 380, status: "sold", ageDays: 24 },
    { key: "turmeric", farmer_id: farmers.harjit.id, title: "Lakadong Turmeric Fingers", description: "High-curcumin (7.5%) Lakadong turmeric, boiled and sun-dried. Vibrant color for premium spice blends.", crop_type: "spices", variety: "Lakadong", quantity: 1800, unit: "kg", harvest_date: iso(-65 * DAY).slice(0, 10), location: "Punjab, India", organic_certified: true, quality_grade: "A", moisture_content: 9, storage_conditions: "Double-lined HDPE bags.", minimum_price: 3.6, starting_price: 3.9, buyout_price: 4.6, status: "sold", ageDays: 19 },
  ]

  const crops: Crop[] = cropSeeds.map(({ key, ageDays, ...c }) => {
    const created = iso(-ageDays * DAY)
    const farmer = users.find((u) => u.id === c.farmer_id)!
    const base = { ...c, images: [] as string[], created_at: created }
    return {
      ...base,
      id: id(`crop:${key}`),
      content_hash: computeContentHash(base, farmer.wallet_address),
      metadata_uri: null,
      nft_token_id: null,
      nft_minted: false,
      nft_transaction_hash: null,
      updated_at: created,
    }
  })
  const crop = (key: string) => crops.find((c) => c.id === id(`crop:${key}`))!

  // --- Auctions with bid ladders ---------------------------------------------
  const auctions: Auction[] = []
  const bids: Bid[] = []
  const notifications: Notification[] = []

  const makeAuction = (key: string, opts: { startedHoursAgo: number; durationHours: number; startTotal: number; reserveTotal: number; increment: number; ladder: [User, number, number][] }) => {
    const c = crop(key)
    const auctionId = id(`auction:${key}`)
    let highest: { user: User; amount: number } | null = null
    opts.ladder.forEach(([bidder, amount, hoursAgo], i) => {
      bids.push({
        id: id(`bid:${key}:${i}`),
        auction_id: auctionId,
        bidder_id: bidder.id,
        amount,
        is_winning: i === opts.ladder.length - 1,
        bid_time: iso(-hoursAgo * HOUR),
        transaction_hash: null,
        created_at: iso(-hoursAgo * HOUR),
      })
      highest = { user: bidder, amount }
    })
    const h = highest as { user: User; amount: number } | null
    auctions.push({
      id: auctionId,
      crop_id: c.id,
      starting_price: opts.startTotal,
      reserve_price: opts.reserveTotal,
      bid_increment: opts.increment,
      current_highest_bid: h?.amount ?? null,
      highest_bidder_id: h?.user.id ?? null,
      start_time: iso(-opts.startedHoursAgo * HOUR),
      end_time: iso((opts.durationHours - opts.startedHoursAgo) * HOUR),
      status: "active",
      total_bids: opts.ladder.length,
      blockchain_id: null,
      transaction_hash: null,
      winner_id: null,
      settled_order_id: null,
      chain_finalized: false,
      created_at: iso(-opts.startedHoursAgo * HOUR),
      updated_at: iso(-opts.startedHoursAgo * HOUR),
    })
  }

  makeAuction("sharbati", { startedHoursAgo: 40, durationHours: 46, startTotal: 5490, reserveTotal: 5600, increment: 50, ladder: [[buyers.deccan, 5490, 38], [buyers.brew, 5600, 30], [buyers.deccan, 5750, 21], [buyers.brew, 5850, 9], [buyers.deccan, 5950, 2]] })
  makeAuction("yirga", { startedHoursAgo: 20, durationHours: 72, startTotal: 9480, reserveTotal: 9800, increment: 100, ladder: [[buyers.nordic, 9480, 18], [buyers.brew, 9600, 11], [buyers.nordic, 9850, 5]] })
  makeAuction("huila", { startedHoursAgo: 6, durationHours: 30, startTotal: 8418, reserveTotal: 8900, increment: 75, ladder: [[buyers.nordic, 8418, 4]] })

  // --- Offers ----------------------------------------------------------------
  const offer = (key: string, cropKey: string, buyer: User, quantity: number, ppu: number, status: Offer["status"], hoursAgo: number, message: string, response?: string): Offer => ({
    id: id(`offer:${key}`),
    crop_id: crop(cropKey).id,
    buyer_id: buyer.id,
    quantity,
    price_per_unit: ppu,
    total_amount: +(quantity * ppu).toFixed(2),
    message,
    response_message: response ?? null,
    status,
    expires_at: iso((72 - hoursAgo) * HOUR),
    created_at: iso(-hoursAgo * HOUR),
    updated_at: iso(-hoursAgo * HOUR),
  })
  const offers: Offer[] = [
    offer("o1", "basmati", buyers.deccan, 5000, 1.6, "pending", 7, "Can you hold 5 t for our Diwali run? We'd collect from Amritsar within 10 days."),
    offer("o2", "sidama", buyers.nordic, 1200, 6.9, "pending", 15, "Looking for a fruit-forward natural for our winter espresso. Happy to commit to the full lot next season."),
    offer("o3", "barley", buyers.brew, 25, 272, "pending", 26, "25 t delivered to Milwaukee by rail — we cover freight from Saskatoon."),
    offer("o4", "cacao", buyers.nordic, 1, 7300, "rejected", 60, "Sample lot for our chocolate program.", "Thanks — we only split in 2 t lots this season."),
    offer("o5", "turmeric", buyers.deccan, 1800, 4.3, "accepted", 20 * 24, "Full lot for our spice blends.", "Deal. Shipping from Ludhiana on Monday."),
  ]

  // --- Orders (history for charts) -------------------------------------------
  const order = (key: string, cropKey: string, buyer: User, source: Order["source"], quantity: number, unitPrice: number, daysAgo: number, payment: Order["payment_status"], delivery: Order["delivery_status"], offerKey?: string): Order => {
    const c = crop(cropKey)
    return {
      id: id(`order:${key}`),
      crop_id: c.id,
      buyer_id: buyer.id,
      farmer_id: c.farmer_id,
      auction_id: null,
      offer_id: offerKey ? id(`offer:${offerKey}`) : null,
      source,
      quantity,
      unit_price: unitPrice,
      total_amount: +(quantity * unitPrice).toFixed(2),
      payment_status: payment,
      delivery_status: delivery,
      delivery_address: buyer.location,
      transaction_hash: null, // seed history is settled off-chain
      created_at: iso(-daysAgo * DAY),
      updated_at: iso(-daysAgo * DAY + 2 * DAY),
    }
  }
  const orders: Order[] = [
    order("r1", "lentil", buyers.deccan, "buy_now", 20, 940, 27, "paid", "delivered"),
    order("r2", "durum", buyers.brew, "auction", 30, 371, 22, "paid", "delivered"),
    order("r3", "turmeric", buyers.deccan, "offer", 1800, 4.3, 19, "paid", "shipped", "o5"),
  ]

  const note = (u: User, type: string, title: string, message: string, link: string, hoursAgo: number, read = false): Notification => ({
    id: id(`note:${u.id}:${title}:${hoursAgo}`),
    user_id: u.id,
    type,
    title,
    message,
    link,
    read,
    created_at: iso(-hoursAgo * HOUR),
  })
  notifications.push(
    note(farmers.harjit, "bid", "New bid on Sharbati Wheat", "Deccan Foods Pvt Ltd bid $5,950 for the lot.", `/crop/${crop("sharbati").id}`, 2),
    note(farmers.harjit, "offer", "New offer on 1121 Basmati", "Deccan Foods Pvt Ltd offered $1.60/kg for 5,000 kg.", "/offers", 7),
    note(buyers.brew, "outbid", "You've been outbid", "Your $5,850 bid on Sharbati Wheat was topped.", `/crop/${crop("sharbati").id}`, 2),
    note(buyers.nordic, "bid", "You're the top bidder", "Your $9,850 bid leads on Yirgacheffe Grade 1.", `/crop/${crop("yirga").id}`, 5, true),
    note(farmers.amara, "offer", "New offer on Sidama Natural", "Nordic Roasters offered $6.90/kg for the full lot.", "/offers", 15),
  )

  return { users, crops, auctions, bids, offers, orders, notifications }
}
