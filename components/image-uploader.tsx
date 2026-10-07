"use client"

import { useRef, useState } from "react"
import { ImagePlus, Loader2, Star, X } from "lucide-react"
import { toast } from "sonner"
import { errorMessage } from "@/lib/api"
import { cn } from "@/lib/utils"

const MAX = 6

export function ImageUploader({ value, onChange }: { value: string[]; onChange: (urls: string[]) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(0)
  const [dragging, setDragging] = useState(false)

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, MAX - value.length)
    if (!list.length) return
    setUploading(list.length)
    const urls: string[] = []
    for (const file of list) {
      try {
        const form = new FormData()
        form.append("file", file)
        const res = await fetch("/api/uploads", { method: "POST", body: form })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        urls.push(data.url)
      } catch (e) {
        toast.error(`${file.name}: ${errorMessage(e, "upload failed")}`)
      } finally {
        setUploading((n) => n - 1)
      }
    }
    if (urls.length) onChange([...value, ...urls])
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          upload(e.dataTransfer.files)
        }}
        className={cn(
          "grid gap-3",
          value.length ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-1",
        )}
      >
        {value.map((src, i) => (
          <div key={src} className="group relative aspect-square overflow-hidden rounded-2xl border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Lot photo ${i + 1}`} className="size-full object-cover" />
            {i === 0 && <span className="glass absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-[11px] font-medium">Cover</span>}
            <div className="absolute top-2 right-2 flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
              {i > 0 && (
                <button type="button" onClick={() => onChange([src, ...value.filter((v) => v !== src)])} className="glass grid size-7 place-items-center rounded-full" aria-label="Make cover photo">
                  <Star className="size-3.5" />
                </button>
              )}
              <button type="button" onClick={() => onChange(value.filter((v) => v !== src))} className="glass grid size-7 place-items-center rounded-full" aria-label="Remove photo">
                <X className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
        {value.length < MAX && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className={cn(
              "text-muted-foreground hover:text-foreground hover:border-border-strong flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed transition-colors",
              value.length ? "aspect-square" : "py-14",
              dragging && "border-signal bg-signal-soft text-signal",
            )}
          >
            {uploading ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
            <span className="text-sm">{uploading ? `Uploading ${uploading}…` : value.length ? "Add" : "Drop photos here or click to browse"}</span>
            {!value.length && <span className="text-xs">JPEG, PNG, WebP · up to 8 MB · {MAX} max</span>}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />
    </div>
  )
}
