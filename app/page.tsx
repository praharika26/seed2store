import Link from "next/link"
import { ArrowRight, ArrowUpRight, Gavel, Handshake, ScanLine, Sprout, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Certificate } from "@/components/certificate"
import { CropCard } from "@/components/crop-card"
import { CropMedia } from "@/components/crop-art"
import { Countdown } from "@/components/bits"
import { HeroActions, VerifyForm } from "@/components/home-client"
import { listAuctions, listCrops, marketStats } from "@/lib/server/services"
import { formatCompactUSD, formatUSD } from "@/lib/format"

export const dynamic = "force-dynamic"

export default async function Home() {
  const [stats, auctions, latest] = await Promise.all([marketStats(), listAuctions("active"), listCrops({}, { limit: 6, sort: "newest" })])
  const feature = auctions[0]
  const heroCrop = feature?.crop ?? latest.data[0]

  return (
    <>
      {/* Hero ------------------------------------------------------------- */}
      <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:px-8 lg:pt-20 lg:pb-32">
        <div className="relative">
          <h1 className="font-display text-[2.8rem] leading-[0.98] sm:text-[3.9rem] lg:text-[4.7rem]">
            Every harvest,
            <br />
            <span className="italic">on the record.</span>
          </h1>
          <p className="text-muted-foreground mt-7 max-w-[34rem] text-[17px] leading-relaxed sm:text-lg">
            Growers list lots with a tamper-evident certificate of origin, then sell direct: buy-now, sealed offers or open auctions. Buyers see exactly where, when and how it was grown, from seed to store.
          </p>
          <HeroActions />
          <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t pt-6">
            <HeroStat label="Lots on market" value={String(stats.lots)} />
            <HeroStat label="Traded to date" value={formatCompactUSD(stats.volume)} />
            <HeroStat label="Growers" value={String(stats.farmers)} />
          </dl>
        </div>

        {heroCrop && (
          <div className="relative mx-auto w-full max-w-[560px] lg:mr-0">
            <div className="absolute -inset-x-6 -top-8 -bottom-10 -z-10 rounded-[40px] bg-[radial-gradient(60%_60%_at_60%_40%,var(--gold-soft),transparent_70%)]" />
            <Certificate crop={heroCrop} farmer={heroCrop.farmer} animate className="rotate-[1.2deg]" />
            {feature && (
              <Link
                href={`/crop/${feature.crop_id}`}
                className="panel lift animate-in fade-in slide-in-from-bottom-4 absolute -bottom-16 -left-4 flex w-[290px] items-center gap-3 p-3 pr-4 duration-700 [animation-delay:900ms] [animation-fill-mode:both] sm:-left-12"
              >
                <div className="size-14 shrink-0 overflow-hidden rounded-xl">
                  <CropMedia crop={feature.crop!} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-live flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase">
                    <span className="live-dot" /> Live · <Countdown end={feature.end_time} compact />
                  </div>
                  <div className="truncate text-sm font-medium">{feature.crop?.title}</div>
                  <div className="text-muted-foreground tabular text-xs">
                    {formatUSD(feature.current_highest_bid ?? feature.starting_price)} · {feature.total_bids} bids
                  </div>
                </div>
              </Link>
            )}
          </div>
        )}
      </section>

      {/* Live auctions ticker --------------------------------------------- */}
      {auctions.length > 0 && (
        <section className="border-y">
          <div className="mx-auto flex max-w-7xl flex-col divide-y px-4 sm:px-6 md:flex-row md:divide-x md:divide-y-0 lg:px-8">
            {auctions.slice(0, 3).map((a) => (
              <Link key={a.id} href={`/crop/${a.crop_id}`} className="group hover:bg-accent/40 flex flex-1 items-center gap-4 py-5 transition-colors md:px-6 md:first:pl-0">
                <span className="live-dot shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{a.crop?.title}</div>
                  <div className="text-muted-foreground text-xs">{a.crop?.location}</div>
                </div>
                <div className="text-right">
                  <div className="tabular text-sm font-medium">{formatUSD(a.current_highest_bid ?? a.starting_price)}</div>
                  <Countdown end={a.end_time} compact className="text-muted-foreground text-xs" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Fresh lots ------------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6 lg:px-8">
        <div className="mb-10 flex items-end justify-between gap-6">
          <h2 className="font-display max-w-xl text-[2.2rem] leading-[1.05] sm:text-[2.6rem]">
            Fresh off the field, <span className="italic">with papers.</span>
          </h2>
          <Button asChild variant="outline" className="hidden sm:inline-flex">
            <Link href="/marketplace">
              All lots <ArrowRight />
            </Link>
          </Button>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {latest.data.map((crop) => (
            <CropCard key={crop.id} crop={crop} />
          ))}
        </div>
      </section>

      {/* Journey ---------------------------------------------------------- */}
      <section id="how" className="mx-auto max-w-7xl scroll-mt-24 px-4 pt-32 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <h2 className="font-display text-[2.2rem] leading-[1.05] sm:text-[2.6rem]">
              From seed <span className="italic">to store</span>, nothing gets lost in between.
            </h2>
            <p className="text-muted-foreground mt-5 max-w-md leading-relaxed">
              Traditional grain and produce trade runs on phone calls and paper slips. Each hand-off is a chance to lose origin data, quality grades or a fair price. Here, the record travels with the lot.
            </p>
          </div>
          <ol className="relative">
            <span className="bg-border absolute top-3 bottom-3 left-[23px] w-px" aria-hidden="true" />
            <Step icon={<Sprout />} title="Register the lot" body="Growers record crop, variety, origin, harvest date, grade and moisture, plus photos. The record is fingerprinted with keccak-256 the moment it's saved." />
            <Step icon={<ScanLine />} title="Certify it on-chain" body="With a wallet on the configured network, the certificate mints as an ERC-721 token. Anyone can later check the record against the chain, and any edit breaks the fingerprint." />
            <Step icon={<Gavel />} title="Sell your way" body="Set a buy-now price, take private offers, or open a timed auction with a reserve. Bids that land in the last ten minutes extend the clock, so nobody gets sniped." />
            <Step icon={<Handshake />} title="Settle direct" body="On-chain sales escrow funds in the contract and transfer the certificate to the buyer. Off-chain deals track payment confirmation between the two parties." />
            <Step icon={<Truck />} title="Ship and confirm" body="The grower marks the lot shipped; the buyer confirms receipt. Every step notifies both sides and lands in each dashboard." last />
          </ol>
        </div>
      </section>

      {/* Audiences -------------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-4 pt-32 sm:px-6 lg:px-8">
        <div className="grid overflow-hidden rounded-[28px] border md:grid-cols-2">
          <Audience
            tone="gold"
            title="For growers"
            lines={["Price discovery from many buyers, not one middleman", "Reserve prices and anti-sniping on every auction", "A certificate buyers can verify without calling you", "One dashboard for offers, bids, orders and revenue"]}
            cta={{ href: "/register-crop", label: "List your first lot" }}
          />
          <Audience
            tone="signal"
            title="For buyers"
            lines={["Origin, harvest date and grade before you commit", "Bid openly, or negotiate privately with an offer", "Escrowed on-chain settlement when the lot is certified", "Track every order from payment to delivery"]}
            cta={{ href: "/marketplace", label: "Browse the market" }}
          />
        </div>
      </section>

      {/* Verify ----------------------------------------------------------- */}
      <section className="mx-auto max-w-3xl px-4 pt-32 text-center sm:px-6">
        <h2 className="font-display text-[2.2rem] leading-[1.05] sm:text-[2.6rem]">
          Holding a lot? <span className="italic">Check its papers.</span>
        </h2>
        <p className="text-muted-foreground mx-auto mt-4 max-w-lg leading-relaxed">
          Paste a certificate serial, token ID or content hash. We recompute the fingerprint from the live record and compare it to what was certified.
        </p>
        <VerifyForm className="mx-auto mt-8 max-w-xl" />
      </section>
    </>
  )
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="tabular mt-1 text-2xl font-medium tracking-tight">{value}</dd>
    </div>
  )
}

function Step({ icon, title, body, last }: { icon: React.ReactNode; title: string; body: string; last?: boolean }) {
  return (
    <li className={`relative flex gap-6 ${last ? "" : "pb-12"}`}>
      <span className="bg-card text-signal relative z-10 grid size-12 shrink-0 place-items-center rounded-full border [&_svg]:size-5">{icon}</span>
      <div className="pt-2.5">
        <h3 className="font-display text-[1.9rem] leading-none">{title}</h3>
        <p className="text-muted-foreground mt-3 max-w-xl leading-relaxed">{body}</p>
      </div>
    </li>
  )
}

function Audience({ tone, title, lines, cta }: { tone: "gold" | "signal"; title: string; lines: string[]; cta: { href: string; label: string } }) {
  return (
    <div className={`relative p-8 sm:p-12 ${tone === "gold" ? "bg-gold-soft" : "bg-signal-soft"} md:first:border-r`}>
      <h3 className="font-display text-5xl">{title}</h3>
      <ul className="mt-8 flex flex-col">
        {lines.map((l) => (
          <li key={l} className="flex gap-3 border-t py-3.5 text-[15px] last:border-b">
            <span className={`mt-2 size-1.5 shrink-0 rounded-full ${tone === "gold" ? "bg-gold" : "bg-signal"}`} />
            {l}
          </li>
        ))}
      </ul>
      <Link href={cta.href} className="group mt-8 inline-flex items-center gap-1.5 font-medium">
        {cta.label}
        <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </Link>
    </div>
  )
}
