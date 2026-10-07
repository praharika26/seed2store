import type { Metadata } from "next"
import { PageHeader } from "@/components/bits"
import { CROP_PHOTOS } from "@/lib/crop-photos"
import { cropTypeInfo } from "@/lib/crops"

export const metadata: Metadata = { title: "Photo credits" }

export default function CreditsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        title={<>Photo <span className="italic">credits</span></>}
        description="Lots without their own photos are illustrated with real, openly licensed photographs from Wikimedia Commons. Each one is credited here, as its license requires. Photos uploaded by growers belong to them."
      />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(CROP_PHOTOS).map(([type, p]) => (
          <figure key={type} className="panel-flat overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.src} alt={p.title} loading="lazy" className="aspect-[4/3] w-full object-cover" />
            <figcaption className="p-4 text-sm">
              <div className="font-display text-lg">{cropTypeInfo(type).label}</div>
              <div className="text-muted-foreground mt-1 leading-relaxed">
                <a href={p.source} target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-4">{p.title}</a>
                <br />
                by {p.artist}
                <br />
                {p.licenseUrl ? <a href={p.licenseUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">{p.license}</a> : p.license}
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}
