import "server-only"
import { NextResponse } from "next/server"
import { ApiError, getUserByAddress } from "./services"
import { NotFoundError } from "./store"
import { sessionAddress } from "./session"
import type { User } from "@/lib/types/database"

type Handler<C> = (req: Request, ctx: C) => Promise<unknown>

/** Wraps a route handler: JSON-encodes results and maps domain errors to clean HTTP responses. */
export function route<C = unknown>(handler: Handler<C>) {
  return async (req: Request, ctx: C) => {
    try {
      const result = await handler(req, ctx)
      if (result instanceof Response) return result
      return NextResponse.json(result ?? { ok: true })
    } catch (error) {
      if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status })
      if (error instanceof NotFoundError) return NextResponse.json({ error: "Not found." }, { status: 404 })
      console.error(`[api] ${req.method} ${new URL(req.url).pathname}`, error)
      return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 })
    }
  }
}

export async function currentUser(): Promise<User | null> {
  const address = await sessionAddress()
  return address ? getUserByAddress(address) : null
}

export async function requireUser(): Promise<User> {
  const user = await currentUser()
  if (!user) throw new ApiError(401, "Connect your wallet and sign in to continue.")
  return user
}

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    throw new ApiError(400, "Request body must be valid JSON.")
  }
}

export function originOf(req: Request) {
  const url = new URL(req.url)
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "")
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host
  return `${proto}://${host}`
}
