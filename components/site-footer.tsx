import Link from "next/link"
import { Logo } from "@/components/logo"

export function SiteFooter() {
  return (
    <footer className="relative z-10 mt-24 border-t">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8">
        <div className="max-w-xs">
          <Logo />
          <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
            A direct market for growers and buyers. Every lot carries a tamper-evident certificate of origin, from seed to store.
          </p>
        </div>
        <FooterCol title="Market" links={[["Browse lots", "/marketplace"], ["Live auctions", "/auctions"], ["Verify a certificate", "/verify"]]} />
        <FooterCol title="Growers" links={[["List a lot", "/register-crop"], ["Dashboard", "/dashboard"], ["Offers", "/offers"]]} />
        <FooterCol title="Platform" links={[["Network status", "/status"], ["On-chain ledger", "/chain"], ["Photo credits", "/credits"]]} />
      </div>
      <div className="text-muted-foreground mx-auto flex max-w-7xl flex-col gap-2 px-4 pb-10 text-xs sm:flex-row sm:justify-between sm:px-6 lg:px-8">
        <span>© {new Date().getFullYear()} Seed2Store</span>
        <span>Prices shown in Indian rupees (₹); on-chain settlement in ETH at the configured rate.</span>
      </div>
    </footer>
  )
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h4 className="text-[13px] font-medium">{title}</h4>
      <ul className="mt-4 flex flex-col gap-2.5">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="text-muted-foreground hover:text-foreground text-sm transition-colors">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
