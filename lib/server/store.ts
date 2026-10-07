import "server-only"
import { promises as fs } from "fs"
import path from "path"
import { randomUUID } from "crypto"
import { GridFSBucket, MongoClient, type Collection, type Db, type Document, type Filter } from "mongodb"
import type { Auction, Bid, Crop, Notification, Offer, Order, User } from "@/lib/types/database"

/**
 * Minimal persistence contract. Domain logic (joins, rules) lives in services.ts and runs identically
 * on every backend, so there is exactly one implementation of each business rule.
 */
export interface Tables {
  users: User
  crops: Crop
  auctions: Auction
  bids: Bid
  offers: Offer
  orders: Order
  notifications: Notification
}
export type TableName = keyof Tables
type Primitive = string | number | boolean | null
export type InsertRow<K extends TableName> = Omit<Tables[K], "id" | "created_at" | "updated_at"> & Partial<Pick<Tables[K], "id" | "created_at">>
export type Where<T> = Partial<{ [K in keyof T]: Primitive | Primitive[] }>

export interface StoredFile {
  data: Uint8Array
  contentType: string
}

export interface Store {
  readonly kind: "local" | "mongodb"
  /** Human-readable location, shown on /status. */
  readonly label: string
  list<K extends TableName>(table: K, where?: Where<Tables[K]>): Promise<Tables[K][]>
  get<K extends TableName>(table: K, id: string): Promise<Tables[K] | null>
  insert<K extends TableName>(table: K, row: InsertRow<K>): Promise<Tables[K]>
  update<K extends TableName>(table: K, id: string, patch: Partial<Tables[K]>): Promise<Tables[K]>
  /**
   * Atomic compare-and-set: applies `patch` only if the row still matches `expected`.
   * Returns the updated row, or null if someone else changed it first.
   */
  updateIf<K extends TableName>(table: K, id: string, expected: Where<Tables[K]>, patch: Partial<Tables[K]>): Promise<Tables[K] | null>
  /** Small key/value settings (e.g. the generated session secret). First writer wins. */
  getOrCreateMeta(key: string, create: () => string): Promise<string>
  putFile(name: string, contentType: string, data: Uint8Array): Promise<void>
  getFile(name: string): Promise<StoredFile | null>
  ping(): Promise<void>
}

export const TABLES: TableName[] = ["users", "crops", "auctions", "bids", "offers", "orders", "notifications"]
const now = () => new Date().toISOString()

function matches<T>(row: T, where?: Where<T>) {
  if (!where) return true
  return Object.entries(where).every(([key, expected]) => {
    const actual = (row as Record<string, unknown>)[key]
    if (Array.isArray(expected)) return expected.includes(actual as Primitive)
    if (expected === null) return actual == null
    return actual === expected
  })
}

export class NotFoundError extends Error {}

const UNIQUE: Partial<Record<TableName, string[]>> = { users: ["wallet_address"] }

// ---------------------------------------------------------------------------
// Local JSON file store: zero configuration, persisted to .data/seed2store.json
// ---------------------------------------------------------------------------

type DB = { [K in TableName]: Tables[K][] } & { _meta?: Record<string, string> }

export const DATA_DIR = process.env.S2S_DATA_DIR || path.join(process.cwd(), ".data")
const DB_FILE = path.join(DATA_DIR, "seed2store.json")
const UPLOAD_DIR = path.join(DATA_DIR, "uploads")

class LocalStore implements Store {
  readonly kind = "local" as const
  readonly label = ".data/seed2store.json"
  private db: DB | null = null
  private loading: Promise<DB> | null = null
  private writeChain: Promise<void> = Promise.resolve()

  private async load(): Promise<DB> {
    if (this.db) return this.db
    if (!this.loading) {
      this.loading = (async () => {
        let db: DB
        try {
          db = JSON.parse(await fs.readFile(DB_FILE, "utf8"))
          for (const t of TABLES) db[t] ??= [] as never
        } catch {
          // Starts empty: only real activity. DEMO_SEED=true opts into the sample market (tests use it).
          if (process.env.DEMO_SEED === "true") {
            const { buildSeed } = await import("./seed")
            db = buildSeed() as DB
          } else {
            db = Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as DB
          }
          await fs.mkdir(DATA_DIR, { recursive: true })
          await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2))
        }
        this.db = db
        return db
      })()
    }
    return this.loading
  }

  private persist() {
    // Serialise writes so concurrent requests never interleave a partial file.
    this.writeChain = this.writeChain.then(async () => {
      const tmp = `${DB_FILE}.${process.pid}.tmp`
      await fs.mkdir(DATA_DIR, { recursive: true })
      await fs.writeFile(tmp, JSON.stringify(this.db, null, 2))
      await fs.rename(tmp, DB_FILE)
    })
    return this.writeChain
  }

  async list<K extends TableName>(table: K, where?: Where<Tables[K]>) {
    const db = await this.load()
    return (db[table] as Tables[K][]).filter((row) => matches(row, where)).map((r) => ({ ...r }))
  }

  async get<K extends TableName>(table: K, id: string) {
    const db = await this.load()
    const row = (db[table] as Tables[K][]).find((r) => (r as { id: string }).id === id)
    return row ? { ...row } : null
  }

  async insert<K extends TableName>(table: K, row: InsertRow<K>) {
    const db = await this.load()
    // Mirrors MongoDB's unique index on users.wallet_address.
    for (const field of UNIQUE[table] ?? []) {
      const value = (row as Record<string, unknown>)[field]
      if ((db[table] as unknown as Record<string, unknown>[]).some((r) => r[field] === value)) throw new Error(`Duplicate ${table}.${field}`)
    }
    const ts = now()
    const full = { id: randomUUID(), created_at: ts, ...row, updated_at: ts } as unknown as Tables[K]
    ;(db[table] as Tables[K][]).push(full)
    await this.persist()
    return { ...full }
  }

  async update<K extends TableName>(table: K, id: string, patch: Partial<Tables[K]>) {
    const updated = await this.updateIf(table, id, {}, patch)
    if (!updated) throw new NotFoundError(`${table} ${id} not found`)
    return updated
  }

  async updateIf<K extends TableName>(table: K, id: string, expected: Where<Tables[K]>, patch: Partial<Tables[K]>) {
    // Single process + synchronous check-and-write between awaits = atomic.
    const db = await this.load()
    const rows = db[table] as Tables[K][]
    const index = rows.findIndex((r) => (r as { id: string }).id === id)
    if (index === -1 || !matches(rows[index], expected)) return null
    rows[index] = { ...rows[index], ...patch, updated_at: now() }
    await this.persist()
    return { ...rows[index] }
  }

  async getOrCreateMeta(key: string, create: () => string) {
    const db = await this.load()
    db._meta ??= {}
    if (!db._meta[key]) {
      db._meta[key] = create()
      await this.persist()
    }
    return db._meta[key]
  }

  async putFile(name: string, _contentType: string, data: Uint8Array) {
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
    await fs.writeFile(path.join(UPLOAD_DIR, name), data)
  }

  async getFile(name: string) {
    try {
      const data = await fs.readFile(path.join(UPLOAD_DIR, name))
      return { data: new Uint8Array(data), contentType: "" }
    } catch {
      return null
    }
  }

  async ping() {
    await this.load()
  }
}

// ---------------------------------------------------------------------------
// MongoDB store: every record, photo (GridFS) and setting lives in one database
// ---------------------------------------------------------------------------

type MongoDoc = Document & { _id: string }

const INDEXES: Record<TableName, Array<Record<string, 1 | -1>>> = {
  users: [{ role: 1 }], // wallet_address gets a unique index below
  crops: [{ status: 1, created_at: -1 }, { farmer_id: 1 }, { content_hash: 1 }, { nft_token_id: 1 }],
  auctions: [{ status: 1, end_time: 1 }, { crop_id: 1 }],
  bids: [{ auction_id: 1, amount: -1 }, { bidder_id: 1 }],
  offers: [{ crop_id: 1, status: 1 }, { buyer_id: 1 }],
  orders: [{ buyer_id: 1 }, { farmer_id: 1 }, { created_at: -1 }],
  notifications: [{ user_id: 1, created_at: -1 }],
}

/** `id` ↔ `_id`: domain objects use string `id`; Mongo stores it as the primary key. */
const toDomain = <T,>(doc: MongoDoc | null): T | null => {
  if (!doc) return null
  const { _id, ...rest } = doc
  return { id: _id, ...rest } as unknown as T
}

function toFilter(where?: Record<string, unknown>): Filter<MongoDoc> {
  const filter: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(where ?? {})) {
    const field = key === "id" ? "_id" : key
    filter[field] = Array.isArray(value) ? { $in: value } : value === null ? { $in: [null] } : value
  }
  return filter as Filter<MongoDoc>
}

function stripId<T extends Record<string, unknown>>(patch: T) {
  const { id: _ignored, ...rest } = patch
  return rest
}

// Survives Next.js hot reloads in dev so we don't open a new pool on every edit.
const globalForMongo = globalThis as unknown as { __s2sMongo?: { client: MongoClient; ready: Promise<Db> } }

class MongoStore implements Store {
  readonly kind = "mongodb" as const
  readonly label: string
  private ready: Promise<Db>

  constructor(uri: string, dbName: string) {
    this.label = `${redact(uri)} · ${dbName}`
    if (!globalForMongo.__s2sMongo) {
      const client = new MongoClient(uri, { appName: "seed2store", serverSelectionTimeoutMS: 6000 })
      globalForMongo.__s2sMongo = { client, ready: client.connect().then((c) => this.prepare(c.db(dbName))) }
    }
    this.ready = globalForMongo.__s2sMongo.ready
    // Don't cache a failed connection forever; the next request retries.
    this.ready.catch(() => {
      delete globalForMongo.__s2sMongo
    })
  }

  private async prepare(db: Db) {
    await Promise.all([
      ...TABLES.flatMap((t) => INDEXES[t].map((spec) => db.collection(t).createIndex(spec))),
      db.collection("users").createIndex({ wallet_address: 1 }, { unique: true, name: "wallet_unique" }),
    ])
    if (process.env.DEMO_SEED === "true" && (await db.collection("users").estimatedDocumentCount()) === 0) {
      const { buildSeed } = await import("./seed")
      const seed = buildSeed() as Record<TableName, Array<{ id: string }>>
      for (const t of TABLES) {
        const docs = seed[t].map(({ id, ...rest }) => ({ _id: id, ...rest }))
        if (docs.length) await db.collection<MongoDoc>(t).insertMany(docs as MongoDoc[], { ordered: false }).catch(() => {})
      }
    }
    return db
  }

  private async col<K extends TableName>(table: K): Promise<Collection<MongoDoc>> {
    return (await this.ready).collection<MongoDoc>(table)
  }

  async list<K extends TableName>(table: K, where?: Where<Tables[K]>) {
    const docs = await (await this.col(table)).find(toFilter(where)).toArray()
    return docs.map((d) => toDomain<Tables[K]>(d)!)
  }

  async get<K extends TableName>(table: K, id: string) {
    return toDomain<Tables[K]>(await (await this.col(table)).findOne({ _id: id }))
  }

  async insert<K extends TableName>(table: K, row: InsertRow<K>) {
    const ts = now()
    const { id, ...rest } = { id: randomUUID(), created_at: ts, ...row } as Record<string, unknown> & { id: string }
    const doc = { _id: id, ...rest, updated_at: ts } as MongoDoc
    await (await this.col(table)).insertOne(doc)
    return toDomain<Tables[K]>(doc)!
  }

  async update<K extends TableName>(table: K, id: string, patch: Partial<Tables[K]>) {
    const updated = await this.updateIf(table, id, {}, patch)
    if (!updated) throw new NotFoundError(`${table} ${id} not found`)
    return updated
  }

  async updateIf<K extends TableName>(table: K, id: string, expected: Where<Tables[K]>, patch: Partial<Tables[K]>) {
    const filter = { ...toFilter(expected as Record<string, unknown>), _id: id } as Filter<MongoDoc>
    const doc = await (await this.col(table)).findOneAndUpdate(
      filter,
      { $set: { ...stripId(patch as Record<string, unknown>), updated_at: now() } },
      { returnDocument: "after" },
    )
    return toDomain<Tables[K]>(doc)
  }

  async getOrCreateMeta(key: string, create: () => string) {
    const meta = (await this.ready).collection<{ _id: string; value: string }>("meta")
    // Upsert with $setOnInsert so concurrent cold starts agree on one value.
    const doc = await meta.findOneAndUpdate({ _id: key }, { $setOnInsert: { value: create() } }, { upsert: true, returnDocument: "after" })
    return doc!.value
  }

  private async bucket() {
    return new GridFSBucket(await this.ready, { bucketName: "uploads" })
  }

  async putFile(name: string, contentType: string, data: Uint8Array) {
    const bucket = await this.bucket()
    // Files are content-addressed (sha256 names), so an existing file is already identical.
    if (await bucket.find({ filename: name }).hasNext()) return
    await new Promise<void>((resolve, reject) => {
      const stream = bucket.openUploadStream(name, { metadata: { contentType } })
      stream.once("finish", () => resolve())
      stream.once("error", reject)
      stream.end(Buffer.from(data))
    })
  }

  async getFile(name: string) {
    const bucket = await this.bucket()
    const file = await bucket.find({ filename: name }).next()
    if (!file) return null
    const chunks: Buffer[] = []
    for await (const chunk of bucket.openDownloadStream(file._id)) chunks.push(chunk as Buffer)
    return { data: new Uint8Array(Buffer.concat(chunks)), contentType: (file.metadata?.contentType as string) ?? "" }
  }

  async ping() {
    await (await this.ready).command({ ping: 1 })
  }
}

function redact(uri: string) {
  return uri.replace(/\/\/([^@/]+)@/, "//•••@").replace(/\?.*$/, "")
}

let store: Store | null = null

export function mongoConfigured() {
  return Boolean(process.env.MONGODB_URI)
}

export function getStore(): Store {
  if (store) return store
  store = mongoConfigured()
    ? new MongoStore(process.env.MONGODB_URI!, process.env.MONGODB_DB || "seed2store")
    : new LocalStore()
  return store
}
