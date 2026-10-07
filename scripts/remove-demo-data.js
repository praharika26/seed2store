// Removes the sample market (DEMO_SEED data) and everything linked to it, keeping real users' data.
//   node scripts/remove-demo-data.js          → dry run, prints what would be deleted
//   node scripts/remove-demo-data.js --apply  → deletes
require("dotenv").config({ path: ".env.local" })
require("dotenv").config()
const { keccak256, toUtf8Bytes, getAddress } = require("ethers")
const { MongoClient } = require("mongodb")

// The seed derives its demo wallets deterministically from these labels (lib/server/seed.ts).
const SEED_LABELS = ["harjit", "amara", "lucia", "ravi", "meadow", "nordic", "deccan", "brew"]
const seedWallet = (label) => getAddress(`0x${keccak256(toUtf8Bytes(`wallet:${label}`)).slice(26)}`).toLowerCase()

async function main() {
  const apply = process.argv.includes("--apply")
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set (for the local JSON store, use npm run db:reset).")
  const client = new MongoClient(process.env.MONGODB_URI)
  await client.connect()
  const db = client.db(process.env.MONGODB_DB || "seed2store")

  const users = await db.collection("users").find({ wallet_address: { $in: SEED_LABELS.map(seedWallet) } }).toArray()
  const userIds = users.map((u) => u._id)
  const crops = await db.collection("crops").find({ farmer_id: { $in: userIds } }).toArray()
  const cropIds = crops.map((c) => c._id)
  const auctions = await db.collection("auctions").find({ crop_id: { $in: cropIds } }).toArray()
  const auctionIds = auctions.map((a) => a._id)

  const plan = {
    users: { _id: { $in: userIds } },
    crops: { _id: { $in: cropIds } },
    auctions: { _id: { $in: auctionIds } },
    bids: { $or: [{ auction_id: { $in: auctionIds } }, { bidder_id: { $in: userIds } }] },
    offers: { $or: [{ crop_id: { $in: cropIds } }, { buyer_id: { $in: userIds } }] },
    orders: { $or: [{ crop_id: { $in: cropIds } }, { buyer_id: { $in: userIds } }, { farmer_id: { $in: userIds } }] },
    notifications: { user_id: { $in: userIds } },
  }

  console.log(`${apply ? "Deleting" : "Would delete"} demo data from "${db.databaseName}":`)
  for (const [col, filter] of Object.entries(plan)) {
    const n = await db.collection(col).countDocuments(filter)
    if (apply && n) await db.collection(col).deleteMany(filter)
    console.log(`  ${col.padEnd(14)} ${n}`)
  }
  console.log(`  demo accounts: ${users.map((u) => u.display_name).join(", ") || "none"}`)
  if (!apply) console.log("\nDry run only. Re-run with --apply to delete.")
  await client.close()
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
