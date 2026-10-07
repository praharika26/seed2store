import { cropTypeInfo } from "@/lib/crops"
import { cn } from "@/lib/utils"

function hashSeed(input: string) {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    return ((h >>> 0) % 10000) / 10000
  }
}

/**
 * Generative landscape for lots without photography: furrowed field in perspective, a low ridge and
 * a sun, tinted by crop type and varied deterministically by lot id. Never a stock placeholder.
 */
export function CropArt({ seed, cropType, className, label }: { seed: string; cropType?: string | null; className?: string; label?: string }) {
  const rand = hashSeed(seed)
  const hue = cropTypeInfo(cropType).hue
  const W = 400
  const H = 300
  const horizon = 118 + rand() * 40
  const vx = 80 + rand() * 240
  const sunX = 60 + rand() * 280
  const sunY = horizon - 30 - rand() * 40
  const sunR = 22 + rand() * 16
  const rows = 16 + Math.floor(rand() * 8)
  const spread = 1400
  const id = `art-${seed.replace(/[^a-z0-9]/gi, "").slice(0, 10)}`

  const c = (l: number, ch: number, h = hue, a = 1) => `oklch(${l} ${ch} ${h} / ${a})`

  const furrows: string[] = []
  for (let i = 0; i < rows; i++) {
    const x0 = vx - spread / 2 + (spread / rows) * i
    const x1 = vx - spread / 2 + (spread / rows) * (i + 1)
    furrows.push(`M${vx},${horizon} L${x0},${H} L${x1},${H} Z`)
  }

  const ridge = (() => {
    const pts: string[] = [`M0,${horizon}`]
    let y = horizon - 6 - rand() * 14
    for (let x = 0; x <= W; x += 40) {
      y = Math.min(horizon - 2, Math.max(horizon - 34, y + (rand() - 0.5) * 18))
      pts.push(`Q${x - 20},${y - 6} ${x},${y}`)
    }
    pts.push(`L${W},${horizon} Z`)
    return pts.join(" ")
  })()

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className={cn("block size-full", className)} role="img" aria-label={label ?? `${cropTypeInfo(cropType).label} field illustration`}>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c(0.26, 0.04, hue + 40)} />
          <stop offset="0.75" stopColor={c(0.58, 0.11, hue - 15)} />
          <stop offset="1" stopColor={c(0.8, 0.12, hue - 25)} />
        </linearGradient>
        <radialGradient id={`${id}-sun`}>
          <stop offset="0" stopColor={c(0.97, 0.08, 95)} />
          <stop offset="0.55" stopColor={c(0.9, 0.14, 85)} />
          <stop offset="1" stopColor={c(0.9, 0.14, 85, 0)} />
        </radialGradient>
        <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c(0.2, 0.03, hue, 0)} />
          <stop offset="1" stopColor={c(0.14, 0.03, hue, 0.55)} />
        </linearGradient>
        <clipPath id={`${id}-field`}>
          <rect x="0" y={horizon} width={W} height={H - horizon} />
        </clipPath>
      </defs>
      <rect width={W} height={H} fill={`url(#${id}-sky)`} />
      <circle cx={sunX} cy={sunY} r={sunR * 2.4} fill={`url(#${id}-sun)`} opacity="0.55" />
      <circle cx={sunX} cy={sunY} r={sunR} fill={c(0.95, 0.1, 92)} />
      <path d={ridge} fill={c(0.36, 0.06, hue + 25)} />
      <g clipPath={`url(#${id}-field)`}>
        <rect x="0" y={horizon} width={W} height={H - horizon} fill={c(0.5, 0.12, hue)} />
        {furrows.map((d, i) => (
          <path key={i} d={d} fill={i % 2 ? c(0.6, 0.14, hue + 6) : c(0.44, 0.11, hue - 6)} />
        ))}
        <rect x="0" y={horizon} width={W} height={H - horizon} fill={`url(#${id}-fade)`} />
      </g>
    </svg>
  )
}

/** Primary photo when present, generative art otherwise. */
export function CropMedia({ crop, className, index = 0 }: { crop: { id: string; crop_type: string; images?: string[]; title: string }; className?: string; index?: number }) {
  const src = crop.images?.[index]
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={crop.title} loading="lazy" className={cn("block size-full object-cover", className)} />
    )
  }
  return <CropArt seed={crop.id} cropType={crop.crop_type} className={className} label={crop.title} />
}
