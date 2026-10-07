// Resets the database so the next start re-seeds fresh demo data.
//   MongoDB (MONGODB_URI set): drops the MONGODB_DB database, including GridFS photos.
//   Local: deletes .data/seed2store.json (uploaded photos are kept).
require("dotenv").config({ path: ".env.local" })
require("dotenv").config()
const fs = require("fs")
const path = require("path")

async function main() {
  if (process.env.MONGODB_URI) {
    const { MongoClient } = require("mongodb")
    const dbName = process.env.MONGODB_DB || "seed2store"
    const client = new MongoClient(process.env.MONGODB_URI)
    await client.connect()
    await client.db(dbName).dropDatabase()
    await client.close()
    console.log(`Dropped MongoDB database "${dbName}". Restart the dev server to re-seed demo data.`)
    return
  }
  const file = path.join(process.env.S2S_DATA_DIR || path.join(__dirname, "..", ".data"), "seed2store.json")
  if (fs.existsSync(file)) {
    fs.rmSync(file)
    console.log(`Removed ${path.relative(process.cwd(), file)}. Restart the dev server to re-seed demo data.`)
  } else {
    console.log("No local database found. Nothing to reset.")
  }
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
