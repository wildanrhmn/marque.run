import Link from "next/link"
import { Header } from "@/components/Header"

const TRACKS = [
  { name: "Best A2A coordination", prize: "$3,000", how: "Three-link redelegation chain on every brief: operator → director → specialist. Caveats narrow at every link." },
  { name: "Best use of Venice AI", prize: "$3,000", how: "Five Venice endpoints in the main flow: chat, image, audio/speech, audio/music, video. Plus crypto/rpc for the mint receipt readback." },
  { name: "Best Use of 1Shot Relayer", prize: "$1,000", how: "EIP-7702 upgrade through 1Shot, every redemption relayed in USDC, webhooks drive the live timeline." },
  { name: "Best x402 + ERC-7710", prize: "$3,000", how: "The broker is a delegation-native x402 facilitator. Payment authority is a signed ERC-7710 chain, not a custodied EIP-3009." },
]

const STAGES = [
  {
    n: "01",
    title: "One signature",
    body: "Operator grants the dapp an ERC-7715 budget permission via MetaMask Advanced Permissions. Spending cap, asset allowlist, expiry, all enforced on-chain.",
    accent: "from-sig/30 to-transparent",
  },
  {
    n: "02",
    title: "Director redelegates",
    body: "A client-side director signs ERC-7710 sub-delegations, one per specialist. Each link only narrows the parent. A2A coordination without any human signing again.",
    accent: "from-violet-500/30 to-transparent",
  },
  {
    n: "03",
    title: "Broker turns delegations into Venice calls",
    body: "Specialists send the signed chain as an x402 payment header. The broker verifies, redeems via 1Shot, pays Venice from its float, returns inference. The agent never holds funds.",
    accent: "from-emerald-500/30 to-transparent",
  },
  {
    n: "04",
    title: "Mint to operator wallet",
    body: "Final ad is composed and minted ERC-721, relayed by 1Shot in USDC. The token's provenance event lists every settlement hash from every specialist call.",
    accent: "from-amber-500/30 to-transparent",
  },
]

export default function LandingPage() {
  return (
    <>
      <Header variant="landing" />
      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-radial" />
          <div className="pointer-events-none absolute inset-0 bg-grid bg-[length:48px_48px] opacity-30" />
          <div className="relative mx-auto max-w-6xl px-6 py-24 sm:py-32">
            <div className="flex flex-col gap-8">
              <div className="flex items-center gap-2">
                <span className="pill text-sig border-sig/30">Built for the MetaMask × 1Shot × Venice Cook Off</span>
              </div>
              <h1 className="font-display text-5xl font-semibold leading-[1.04] tracking-tight text-balance sm:text-6xl lg:text-[5.5rem]">
                Agents that pay
                <br />
                for themselves.
              </h1>
              <p className="max-w-2xl text-pretty text-base text-neutral-300 sm:text-lg">
                MARQUE is a serverless runtime for agent swarms. No API keys. No servers. No custodied funds. Every agent carries a scoped MetaMask Smart Account delegation as its entire operating budget, pays Venice via x402, and settles through the 1Shot permissionless relayer in USDC.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/run" className="btn-primary">
                  launch the demo
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Link>
                <a href="#how" className="btn-ghost">
                  how it works
                </a>
              </div>
              <div className="mt-6 grid gap-2 text-sm text-neutral-400 sm:grid-cols-3">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  ERC-7710 redelegation
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-sig" />
                  ERC-7715 advanced permissions
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                  x402 over delegation
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="border-t border-white/5">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="mb-12 flex flex-col gap-3">
              <span className="pill w-fit">how it works</span>
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                One brief. One signature. A swarm settles.
              </h2>
              <p className="max-w-2xl text-neutral-400">
                Everything below happens on Base mainnet, in under two minutes, for about $2 USDC. The operator
                signs once. Three redelegations propagate the budget. Five Venice endpoints produce the ad. 1Shot
                relays every leg in stablecoins.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {STAGES.map((s) => (
                <div key={s.n} className={`panel relative overflow-hidden p-6`}>
                  <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${s.accent}`} />
                  <div className="flex items-start justify-between">
                    <span className="font-mono text-[12px] text-neutral-500">{s.n}</span>
                  </div>
                  <h3 className="mt-6 font-display text-xl font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-neutral-300">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/5">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="mb-10">
              <span className="pill w-fit">tracks targeted</span>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Built to hit four prize tracks, not one.
              </h2>
            </div>
            <div className="grid gap-3">
              {TRACKS.map((t) => (
                <div key={t.name} className="panel flex flex-col gap-1 p-5 md:flex-row md:items-center md:gap-6">
                  <div className="flex w-full items-baseline justify-between gap-3 md:w-72 md:flex-col md:items-start md:justify-start">
                    <span className="font-display text-base font-semibold text-white">{t.name}</span>
                    <span className="pill text-emerald-300 border-emerald-500/30">{t.prize}</span>
                  </div>
                  <p className="text-sm text-neutral-300">{t.how}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/5 bg-white/[0.01]">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="mb-8">
              <span className="pill w-fit">the broker</span>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                A delegation-native x402 facilitator.
              </h2>
              <p className="mt-3 max-w-2xl text-neutral-400">
                Venice expects standard EIP-3009 USDC payments. Agents carry signed delegation chains.
                The broker bridges the two: it accepts X-PAYMENT as a delegation chain, redeems via 1Shot,
                then pays Venice with its own EIP-3009 from a small float. The pattern works for any x402 service.
              </p>
            </div>
            <pre className="panel overflow-x-auto p-6 text-[12px] leading-relaxed text-neutral-300">
{`specialist agent
  └─ POST /broker/venice/image
       X-PAYMENT: base64({ scheme: "marque-v1", delegationContext: 0x... })

MARQUE broker  (on Progena VPS)
  1. verify delegation chain off-chain
  2. relayer_send7710Transaction (1Shot)
       └─ webhook on destinationUrl confirms settlement
  3. forward to Venice with EIP-3009 X-PAYMENT from broker float
  4. stream response back to specialist

Venice
  └─ inference, image, audio, video, RPC (x402 native, Base mainnet)`}
            </pre>
          </div>
        </section>

        <footer className="border-t border-white/5">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
            <div>
              built for the <span className="text-white">MetaMask × 1Shot × Venice Dev Cook Off</span>, May 2026.
            </div>
            <div className="flex gap-4">
              <Link href="/run" className="hover:text-white transition">launch</Link>
              <a href="https://github.com/wildanrhmn/marque" target="_blank" rel="noreferrer" className="hover:text-white transition">github</a>
              <a href="https://x.com/MetaMaskDev" target="_blank" rel="noreferrer" className="hover:text-white transition">@MetaMaskDev</a>
            </div>
          </div>
        </footer>
      </main>
    </>
  )
}
