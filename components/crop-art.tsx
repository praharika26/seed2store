import { cropPhoto, type CropPhoto } from "@/lib/crop-photos"
import { cn } from "@/lib/utils"

/**
 * A lot's own photo when it has one; otherwise a real, openly licensed photograph of that crop
 * (Wikimedia Commons, credited via <PhotoCredit />).
 */
export function CropMedia({ crop, className, index = 0 }: { crop: { id: string; crop_type: string; images?: string[]; title: string }; className?: string; index?: number }) {
  const src = crop.images?.[index]
  const fallback = cropPhoto(crop.crop_type)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src ?? fallback.src}
      alt={src ? crop.title : `${fallback.title} (representative photo)`}
      loading="lazy"
      className={cn("block size-full object-cover", className)}
    />
  )
}

/** Photo of a crop type by itself (404 page, unknown tokens). */
export function CropPhotoImage({ cropType, className }: { cropType?: string | null; className?: string }) {
  const p = cropPhoto(cropType)
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={p.src} alt={p.title} loading="lazy" className={cn("block size-full object-cover", className)} />
}

/** Attribution line for a representative photo, as its license requires. */
export function PhotoCredit({ photo, className }: { photo: CropPhoto; className?: string }) {
  return (
    <p className={cn("text-muted-foreground text-[11px] leading-snug", className)}>
      Representative photo: <a href={photo.source} target="_blank" rel="noreferrer" className="underline underline-offset-2">{photo.title}</a> by {photo.artist}
      {" · "}
      {photo.licenseUrl ? <a href={photo.licenseUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">{photo.license}</a> : photo.license}
      {" · via Wikimedia Commons"}
    </p>
  )
}
