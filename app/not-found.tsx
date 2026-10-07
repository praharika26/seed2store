import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CropPhotoImage } from "@/components/crop-art"

export default function NotFound() {
  return (
    <div className="mx-auto grid min-h-[70vh] max-w-5xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2">
      <div>
        <p className="text-muted-foreground font-mono text-sm">404</p>
        <h1 className="font-display mt-2 text-6xl leading-none">
          Fallow <span className="italic">ground.</span>
        </h1>
        <p className="text-muted-foreground mt-4 max-w-sm leading-relaxed">Nothing is planted at this address. The lot may have been withdrawn, or the link mistyped.</p>
        <div className="mt-8 flex gap-3">
          <Button asChild><Link href="/marketplace">Browse the market</Link></Button>
          <Button asChild variant="outline"><Link href="/">Home</Link></Button>
        </div>
      </div>
      <div className="aspect-[4/3] overflow-hidden rounded-[24px] border">
        <CropPhotoImage cropType="barley" />
      </div>
    </div>
  )
}
