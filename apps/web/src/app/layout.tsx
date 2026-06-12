import type { Metadata } from "next"
import { Geist, Geist_Mono, Unbounded } from "next/font/google"
import "./globals.css"
import { Providers } from "@/providers/root"

const sans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  adjustFontFallback: false,
})
const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  adjustFontFallback: false,
})
const display = Unbounded({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "Marque — a serverless runtime for agent swarms",
  description:
    "Put a crew of specialist agents to work on a budget you control. Give a brief, they build a finished piece, and you own the result. No keys handed over, no funds held, nothing left running.",
  metadataBase: new URL("https://marque.run"),
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "Marque",
    description:
      "Agents that pay for themselves. Set a budget, write one sentence, and a finished piece comes back to your wallet.",
    type: "website",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${sans.variable} ${mono.variable} ${display.variable}`}>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
