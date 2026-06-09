"use client"
import { type ReactNode, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiProvider } from "wagmi"
import { wagmiConfig } from "@/lib/wagmi"
import { SmoothScroll } from "@/components/SmoothScroll"

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 1000 * 30, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  )

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={client}>
        <SmoothScroll />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
