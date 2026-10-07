import { NextResponse } from "next/server"
import { getStore } from "@/lib/server/store"
import { buildMetadata } from "@/lib/server/ipfs"
import { originOf } from "@/lib/server/http"

export const dynamic = "force-dynamic"

/** tokenURI target for certificates minted without IPFS pinning. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const crop = await getStore().get("crops", id).catch(() => null)
  if (!crop) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const farmer = await getStore().get("users", crop.farmer_id)
  if (!farmer) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(buildMetadata(crop, farmer, originOf(req)), {
    headers: { "Cache-Control": "public, max-age=60" },
  })
}
