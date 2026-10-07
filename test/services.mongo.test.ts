// @vitest-environment node
// Runs the same suite against a real MongoDB in a throwaway database.
// Uses MONGODB_TEST_URI, else a local server on 27017; skipped if neither is reachable.
import { afterAll, describe, it } from "vitest"
import { MongoClient } from "mongodb"
import { runServiceSuite } from "./services.suite"

const uri = process.env.MONGODB_TEST_URI || "mongodb://127.0.0.1:27017"
const dbName = `s2s_test_${Date.now()}`

async function reachable() {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 1500 })
  try {
    await client.connect()
    await client.db("admin").command({ ping: 1 })
    return true
  } catch {
    return false
  } finally {
    await client.close().catch(() => {})
  }
}

const available = await reachable()

if (available) {
  process.env.MONGODB_URI = uri
  process.env.MONGODB_DB = dbName
  runServiceSuite("mongodb")
  afterAll(async () => {
    const client = new MongoClient(uri)
    await client.connect()
    await client.db(dbName).dropDatabase()
    await client.close()
    const g = globalThis as unknown as { __s2sMongo?: { client: MongoClient } }
    await g.__s2sMongo?.client.close()
  })
} else {
  describe.skip(`MongoDB (${uri} unreachable)`, () => it("skipped", () => {}))
}
