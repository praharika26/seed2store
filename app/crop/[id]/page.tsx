import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { LotView } from "@/components/lot/lot-view"
import { getCrop } from "@/lib/server/services"

export const dynamic = "force-dynamic"

async function load(id: string) {
  try {
    return await getCrop(id)
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const crop = await load((await params).id)
  if (!crop) return { title: "Lot not found" }
  return { title: crop.title, description: crop.description.slice(0, 160) }
}

export default async function CropPage({ params }: { params: Promise<{ id: string }> }) {
  const crop = await load((await params).id)
  if (!crop) notFound()
  return <LotView initial={crop} />
}
