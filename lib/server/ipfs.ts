import "server-only"
import { createHash } from "crypto"
import { getStore } from "./store"
import { certificateSerial } from "@/lib/certificate"
import { cropTypeInfo } from "@/lib/crops"
import type { Crop, User } from "@/lib/types/database"

const GATEWAY = process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud"
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
}

export function pinataConfigured() {
  return Boolean(process.env.PINATA_JWT)
}

async function pinata(endpoint: string, init: RequestInit) {
  const res = await fetch(`https://api.pinata.cloud/pinning/${endpoint}`, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${process.env.PINATA_JWT}` },
  })
  if (!res.ok) throw new Error(`Pinata ${endpoint} failed (${res.status}): ${await res.text()}`)
  return ((await res.json()) as { IpfsHash: string }).IpfsHash
}

export async function pinJSON(content: unknown, name: string) {
  return pinata("pinJSONToIPFS", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pinataContent: content, pinataMetadata: { name } }),
  })
}

/** Stores an image and returns a public URL plus its SHA-256 (the file's content fingerprint). */
export async function storeImage(file: File) {
  const ext = ALLOWED_IMAGE_TYPES[file.type]
  if (!ext) throw new Error("Upload a JPEG, PNG, WebP, AVIF or GIF image.")
  const bytes = Buffer.from(await file.arrayBuffer())
  const sha256 = createHash("sha256").update(bytes).digest("hex")

  if (pinataConfigured()) {
    const form = new FormData()
    form.append("file", new Blob([bytes], { type: file.type }), file.name || `crop.${ext}`)
    form.append("pinataMetadata", JSON.stringify({ name: `seed2store-${sha256.slice(0, 12)}` }))
    const cid = await pinata("pinFileToIPFS", { method: "POST", body: form })
    return { url: `${GATEWAY}/ipfs/${cid}`, cid, sha256 }
  }

  // MongoDB: GridFS bucket "uploads". Local: .data/uploads. Content-addressed either way.
  const name = `${sha256}.${ext}`
  await getStore().putFile(name, file.type, new Uint8Array(bytes))
  return { url: `/api/uploads/${name}`, cid: null, sha256 }
}

/** ERC-721 metadata (OpenSea-compatible) for a crop certificate. */
export function buildMetadata(crop: Crop, farmer: Pick<User, "wallet_address" | "display_name">, origin: string) {
  const absolute = (u: string) => (u.startsWith("/") ? `${origin}${u}` : u)
  return {
    name: `${crop.title} — ${certificateSerial(crop.content_hash)}`,
    description: crop.description,
    image: crop.images[0] ? absolute(crop.images[0]) : undefined,
    external_url: `${origin}/crop/${crop.id}`,
    attributes: [
      { trait_type: "Crop", value: cropTypeInfo(crop.crop_type).label },
      crop.variety && { trait_type: "Variety", value: crop.variety },
      { trait_type: "Quantity", value: `${crop.quantity} ${crop.unit}` },
      crop.location && { trait_type: "Origin", value: crop.location },
      crop.harvest_date && { trait_type: "Harvested", value: crop.harvest_date },
      crop.quality_grade && { trait_type: "Grade", value: crop.quality_grade },
      { trait_type: "Organic", value: crop.organic_certified ? "Certified" : "No" },
      crop.moisture_content != null && { trait_type: "Moisture %", value: crop.moisture_content },
    ].filter(Boolean),
    properties: {
      farmer: farmer.wallet_address,
      farmer_name: farmer.display_name ?? null,
      content_hash: crop.content_hash,
      serial: certificateSerial(crop.content_hash),
      images: crop.images.map(absolute),
    },
  }
}
