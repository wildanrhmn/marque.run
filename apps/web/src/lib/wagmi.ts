import { http, createConfig } from "wagmi"
import { base, baseSepolia } from "wagmi/chains"
import { metaMask, injected } from "wagmi/connectors"

const transports = {
  [base.id]: http(
    process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://mainnet.base.org",
  ),
  [baseSepolia.id]: http(
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org",
  ),
}

export const wagmiConfig = createConfig({
  chains: [base, baseSepolia],
  connectors: [
    metaMask({
      dappMetadata: {
        name: "MARQUE",
        url: "https://marque.run",
      },
    }),
    injected(),
  ],
  transports,
  ssr: true,
})

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig
  }
}
