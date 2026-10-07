"use client"

import useSWR, { type SWRConfiguration } from "swr"

export class ApiRequestError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init
  const res = await fetch(path, {
    ...rest,
    credentials: "same-origin",
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new ApiRequestError(res.status, data?.error ?? `Request failed (${res.status})`)
  return data as T
}

export function useApi<T>(path: string | null, config?: SWRConfiguration<T>) {
  return useSWR<T>(path, (p: string) => api<T>(p), { revalidateOnFocus: true, ...config })
}

export function errorMessage(error: unknown, fallback = "Something went wrong.") {
  if (!error) return fallback
  const e = error as { shortMessage?: string; reason?: string; message?: string; code?: string | number; info?: { error?: { message?: string } } }
  if (e.code === "ACTION_REJECTED" || e.code === 4001) return "You rejected the request in your wallet."
  const raw = e.reason || e.info?.error?.message || e.shortMessage || e.message || fallback
  return raw.replace(/^execution reverted:?\s*/i, "").replace(/\(action=.*$/s, "").trim() || fallback
}
