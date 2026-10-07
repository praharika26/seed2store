import type { Metadata, Viewport } from "next"
import type React from "react"
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
import { WalletProvider } from "@/lib/wallet/wallet-provider"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { ConnectDialog } from "@/components/connect-dialog"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument" })

export const metadata: Metadata = {
  title: { default: "Seed2Store — Certified crops, traded direct", template: "%s · Seed2Store" },
  description: "A direct marketplace where growers list certified lots, run transparent auctions and sell straight to buyers, with every lot carrying a tamper-evident certificate of origin.",
  icons: { icon: "/icon.svg" },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b120e" },
    { media: "(prefers-color-scheme: light)", color: "#f6f3ea" },
  ],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geist.variable} ${geistMono.variable} ${instrument.variable}`}>
      <body className="font-sans">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <WalletProvider>
            <a href="#main" className="bg-primary text-primary-foreground sr-only z-[60] rounded-full px-4 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
              Skip to content
            </a>
            <SiteHeader />
            <main id="main" className="relative z-10">{children}</main>
            <SiteFooter />
            <ConnectDialog />
            <Toaster position="bottom-right" richColors={false} closeButton />
          </WalletProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
