import { getStore } from "@/lib/server/store"
import { ALLOWED_IMAGE_TYPES } from "@/lib/server/ipfs"

const MIME = Object.fromEntries(Object.entries(ALLOWED_IMAGE_TYPES).map(([mime, ext]) => [ext, mime]))

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params
  // Files are content-addressed (sha256.ext); reject anything else, including path traversal.
  const match = /^([a-f0-9]{64})\.([a-z]+)$/.exec(file)
  if (!match || !MIME[match[2]]) return new Response("Not found", { status: 404 })
  const stored = await getStore().getFile(file).catch(() => null)
  if (!stored) return new Response("Not found", { status: 404 })
  return new Response(new Uint8Array(stored.data), {
    headers: { "Content-Type": MIME[match[2]], "Cache-Control": "public, max-age=31536000, immutable" },
  })
}
