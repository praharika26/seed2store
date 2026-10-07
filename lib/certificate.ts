import { keccak256, toUtf8Bytes } from "ethers"
import type { Crop } from "@/lib/types/database"

/**
 * Provenance fields that must never change after registration. Quantity, prices and status
 * legitimately move as the lot trades, so they are deliberately excluded.
 */
export function provenancePayload(crop: Pick<Crop,
  "title" | "description" | "crop_type" | "variety" | "unit" | "harvest_date" | "location" |
  "organic_certified" | "quality_grade" | "moisture_content" | "storage_conditions" | "images" | "created_at"
>, farmerWallet: string) {
  return {
    v: 1,
    farmer: farmerWallet.toLowerCase(),
    title: crop.title,
    description: crop.description,
    crop_type: crop.crop_type,
    variety: crop.variety ?? null,
    unit: crop.unit,
    harvest_date: crop.harvest_date ?? null,
    location: crop.location ?? null,
    organic_certified: Boolean(crop.organic_certified),
    quality_grade: crop.quality_grade ?? null,
    moisture_content: crop.moisture_content ?? null,
    storage_conditions: crop.storage_conditions ?? null,
    images: [...(crop.images ?? [])],
    registered_at: crop.created_at,
  }
}

/** Deterministic JSON (sorted keys) so the hash is stable across runtimes. */
export function canonicalJSON(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.keys(value as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJSON((value as Record<string, unknown>)[k])}`)
      .join(",")}}`
  }
  return JSON.stringify(value ?? null)
}

export function computeContentHash(crop: Parameters<typeof provenancePayload>[0], farmerWallet: string) {
  return keccak256(toUtf8Bytes(canonicalJSON(provenancePayload(crop, farmerWallet))))
}

/** Human-friendly certificate serial derived from the content hash, e.g. S2S-7F3A-91C2. */
export function certificateSerial(hash?: string | null) {
  if (!hash) return "S2S-PENDING"
  const h = hash.replace(/^0x/, "").toUpperCase()
  return `S2S-${h.slice(0, 4)}-${h.slice(4, 8)}`
}
