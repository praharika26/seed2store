import "server-only"
import { createHmac, randomBytes, timingSafeEqual } from "crypto"
import { cookies } from "next/headers"
import { getStore } from "./store"

const SESSION_COOKIE = "s2s_session"
const NONCE_COOKIE = "s2s_nonce"
const SESSION_TTL_S = 7 * 24 * 3600
const NONCE_TTL_S = 10 * 60

let cachedSecret: Promise<string> | null = null

/**
 * AUTH_SECRET when set; otherwise a random secret generated once and kept in the database
 * (MongoDB `meta` collection, or the local JSON file), so every instance signs with the same key.
 */
function secret() {
  if (process.env.AUTH_SECRET) return Promise.resolve(process.env.AUTH_SECRET)
  cachedSecret ??= getStore()
    .getOrCreateMeta("auth-secret", () => randomBytes(32).toString("hex"))
    .catch((e) => {
      cachedSecret = null
      throw e
    })
  return cachedSecret
}

async function sign(payload: object) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const mac = createHmac("sha256", await secret()).update(body).digest("base64url")
  return `${body}.${mac}`
}

async function unsign<T>(token?: string): Promise<T | null> {
  if (!token) return null
  const [body, mac] = token.split(".")
  if (!body || !mac) return null
  const expected = createHmac("sha256", await secret()).update(body).digest("base64url")
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { exp: number }
    if (!data.exp || data.exp < Date.now() / 1000) return null
    return data
  } catch {
    return null
  }
}

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
})

export function signInMessage(address: string, nonce: string, origin: string) {
  return [
    "Sign in to Seed2Store",
    "",
    "This request proves you own this wallet. It costs nothing and does not send a transaction.",
    "",
    `Wallet: ${address.toLowerCase()}`,
    `Origin: ${origin}`,
    `Nonce: ${nonce}`,
  ].join("\n")
}

export async function issueNonce() {
  const nonce = randomBytes(16).toString("hex")
  const jar = await cookies()
  jar.set(NONCE_COOKIE, await sign({ nonce, exp: Math.floor(Date.now() / 1000) + NONCE_TTL_S }), cookieOptions(NONCE_TTL_S))
  return nonce
}

export async function consumeNonce() {
  const jar = await cookies()
  const data = await unsign<{ nonce: string }>(jar.get(NONCE_COOKIE)?.value)
  jar.delete(NONCE_COOKIE)
  return data?.nonce ?? null
}

export async function startSession(address: string) {
  const jar = await cookies()
  jar.set(SESSION_COOKIE, await sign({ address: address.toLowerCase(), exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S }), cookieOptions(SESSION_TTL_S))
}

export async function endSession() {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
}

export async function sessionAddress(): Promise<string | null> {
  const jar = await cookies()
  return (await unsign<{ address: string }>(jar.get(SESSION_COOKIE)?.value))?.address ?? null
}
