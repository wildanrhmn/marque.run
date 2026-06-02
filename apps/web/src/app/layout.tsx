import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "@/providers/root"

export const metadata: Metadata = {
  title: "MARQUE — serverless agent runtime",
  description:
    "Agents with no API keys, no servers, no custodied funds. A scoped MetaMask Smart Account delegation is their entire operating budget. Built on ERC-7710 redelegation, ERC-7715 advanced permissions, x402, Venice AI, and the 1Shot permissionless relayer.",
  metadataBase: new URL("https://marque.run"),
  openGraph: {
    title: "MARQUE",
    description:
      "Agents that pay for themselves. One signature funds a swarm. Type a brief, get a multimodal video ad minted to your wallet.",
    type: "website",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
