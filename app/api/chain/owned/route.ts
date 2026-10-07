import { isAddress } from "ethers"
import { route } from "@/lib/server/http"
import { listChainEvents, tokensOwnedBy } from "@/lib/server/chain"
import { ApiError, lotsByToken } from "@/lib/server/services"

export const dynamic = "force-dynamic"

/** Certificates an address holds now, plus those it originally minted (issued). */
export const GET = route(async (req) => {
  const address = new URL(req.url).searchParams.get("address") ?? ""
  if (!isAddress(address)) throw new ApiError(400, "A valid wallet address is required.")
  const [held, events] = await Promise.all([tokensOwnedBy(address), listChainEvents()])
  const issued = events
    .filter((e) => e.name === "CropCertificateCreated" && String(e.args.farmer).toLowerCase() === address.toLowerCase())
    .map((e) => e.tokenId as number)
  const lots = await lotsByToken([...held, ...issued])
  const shape = (id: number) => {
    const lot = lots.get(id)
    const minted = events.find((e) => e.name === "CropCertificateCreated" && e.tokenId === id)
    return {
      tokenId: id,
      title: lot?.title ?? (minted?.args.title as string | undefined) ?? `Certificate #${id}`,
      lot: lot ? { id: lot.id, crop_type: lot.crop_type, images: lot.images, status: lot.status } : null,
      mintedAt: minted?.timestamp ?? null,
      mintTx: minted?.txHash ?? null,
    }
  }
  return { held: held.map(shape), issued: [...new Set(issued)].map(shape) }
})
