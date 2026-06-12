import Link from "next/link"
import { Header } from "@/components/Header"
import { Hero } from "@/components/Hero"
import { SealMark } from "@/components/SealMark"
import { Reveal, RevealStagger, RevealItem } from "@/components/Reveal"

const CREW = [
  { glyph: "✎", name: "Concept", role: "writes the brief into a script and storyboard" },
  { glyph: "◫", name: "Image", role: "generates each scene as cinematic stills" },
  { glyph: "◉", name: "Voice", role: "narrates the script in a chosen voice" },
  { glyph: "♪", name: "Music", role: "scores an original soundtrack to match" },
  { glyph: "▶", name: "Video", role: "brings the scenes to motion and assembles the cut" },
]

const STEPS = [
  {
    n: "01",
    title: "Set a budget",
    body: "Grant a capped, revocable spending mandate straight from your wallet. One signature. The crew works inside it and never holds your funds or your keys.",
  },
  {
    n: "02",
    title: "Give a brief",
    body: "Describe what you want in a sentence. The crew plans the work, divides it among specialists, and gets to work in parallel.",
  },
  {
    n: "03",
    title: "Own the result",
    body: "The finished piece is minted to your wallet, with a complete on-chain record of what was made and exactly what it cost.",
  },
]

const PRICES = [
  { label: "An image", price: "$0.05" },
  { label: "A voiceover", price: "~$0.01" },
  { label: "A music track", price: "$0.24" },
  { label: "A video clip", price: "from $0.07" },
]

const STACK = [
  {
    name: "MetaMask Smart Accounts",
    body: "A scoped, revocable budget via ERC-7710 delegation. The agent carries an allowance, never your keys.",
  },
  {
    name: "1Shot Relayer",
    body: "Redeems the delegation on-chain and pays gas in USDC, so the agents hold zero ETH.",
  },
  {
    name: "Venice AI",
    body: "Private, premium models for text, image, voice, music, and video, paid for per render.",
  },
  {
    name: "Base",
    body: "Every step settles on mainnet, with a full on-chain record of what it cost.",
  },
]

export default function LandingPage() {
  return (
    <>
      <Header variant="landing" />
      <main>
        <Hero />

        <section id="crew" className="relative border-t border-bone/[0.06]">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <Reveal>
              <div className="mb-12 flex flex-col gap-3">
                <span className="pill w-fit">the crew</span>
                <h2 className="font-display text-3xl font-semibold tracking-tight text-bone sm:text-4xl">
                  A crew, not a chatbot.
                </h2>
                <p className="max-w-2xl text-bone/60">
                  Five specialist agents that each do one thing well. Give them a brief and they
                  split the work, hand off to each other, and return a finished piece, not a wall of text.
                </p>
              </div>
            </Reveal>
            <RevealStagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CREW.map((c) => (
                <RevealItem key={c.name}>
                  <div className="panel group h-full p-5">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-lg border border-brass/25 bg-brass/[0.06] font-mono text-base text-brass">
                        {c.glyph}
                      </span>
                      <span className="font-display text-base font-semibold text-bone">{c.name}</span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-bone/60">{c.role}</p>
                  </div>
                </RevealItem>
              ))}
              <RevealItem>
                <div className="writ flex h-full flex-col justify-center gap-1 p-5">
                  <span className="font-display text-base font-semibold text-brass">+ your own</span>
                  <p className="text-sm leading-relaxed text-bone/60">
                    The crew is open-ended. New specialists slot in the same way the first five did.
                  </p>
                </div>
              </RevealItem>
            </RevealStagger>
          </div>
        </section>

        <section id="how" className="relative border-t border-bone/[0.06]">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <Reveal>
              <div className="mb-12 flex flex-col gap-3">
                <span className="pill w-fit">how it works</span>
                <h2 className="font-display text-3xl font-semibold tracking-tight text-bone sm:text-4xl">
                  One brief. One signature. A finished piece.
                </h2>
                <p className="max-w-2xl text-bone/60">
                  Start to finish in about two minutes, for a couple of dollars. You sign once, the
                  crew does the rest, and the work settles to you.
                </p>
              </div>
            </Reveal>
            <RevealStagger className="grid gap-4 md:grid-cols-3">
              {STEPS.map((s) => (
                <RevealItem key={s.n}>
                  <div className="panel group h-full p-6">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[12px] text-brass">{s.n}</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-brass/40 transition group-hover:bg-brass group-hover:shadow-glow-brass" />
                    </div>
                    <h3 className="mt-6 font-display text-xl font-semibold text-bone">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-bone/60">{s.body}</p>
                  </div>
                </RevealItem>
              ))}
            </RevealStagger>
          </div>
        </section>

        <section id="pricing" className="relative border-t border-bone/[0.06]">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <Reveal>
              <div className="mb-12 flex flex-col gap-3">
                <span className="pill w-fit">the math</span>
                <h2 className="font-display text-3xl font-semibold tracking-tight text-bone sm:text-4xl">
                  Every premium model. No subscription.
                </h2>
                <p className="max-w-2xl text-bone/60">
                  Making one ad means renting four tools you barely use, around $90 a month for access
                  you mostly leave idle, and you still own none of it. Marque charges per render, at cost,
                  from one budget you control.
                </p>
              </div>
            </Reveal>
            <div className="grid gap-4 lg:grid-cols-2">
              <Reveal>
                <div className="panel flex h-full flex-col p-6">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-dim">the subscription stack</div>
                  <ul className="mt-5 space-y-3 text-sm text-bone/55">
                    {["Midjourney", "ElevenLabs", "Suno", "Runway"].map((tool) => (
                      <li key={tool} className="flex items-center justify-between gap-3 border-b border-bone/[0.05] pb-3">
                        <span className="text-bone/75">{tool}</span>
                        <span className="text-[12px] text-slate-dim">a monthly seat</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto flex items-baseline justify-between pt-6">
                    <span className="text-sm text-bone/50">around</span>
                    <span className="font-display text-2xl font-semibold text-bone/80 line-through decoration-brass/40">
                      $90 / mo
                    </span>
                  </div>
                  <p className="mt-2 text-[12px] text-slate-dim">Priced for access, not use. You own nothing you make.</p>
                </div>
              </Reveal>
              <Reveal delay={0.1}>
                <div className="panel flex h-full flex-col border-brass/30 bg-brass/[0.04] p-6">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-brass">marque, per render</div>
                  <ul className="mt-5 space-y-3 text-sm">
                    {PRICES.map((p) => (
                      <li key={p.label} className="flex items-center justify-between gap-3 border-b border-bone/[0.06] pb-3">
                        <span className="text-bone/75">{p.label}</span>
                        <span className="data text-brass">{p.price}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto flex items-baseline justify-between pt-6">
                    <span className="text-sm text-bone/50">a full ad</span>
                    <span className="font-display text-2xl font-semibold text-bone">$1 – $4</span>
                  </div>
                  <p className="mt-2 text-[12px] text-brass/75">
                    Pay for the few renders you want. Own every one, minted on-chain.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <section id="built-on" className="relative border-t border-bone/[0.06]">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <Reveal>
              <div className="mb-12 flex flex-col gap-3">
                <span className="pill w-fit">under the hood</span>
                <h2 className="font-display text-3xl font-semibold tracking-tight text-bone sm:text-4xl">
                  Real money, real rails.
                </h2>
                <p className="max-w-2xl text-bone/60">
                  No demo wallets, no testnet, no funds held. Every render is paid for and settled on
                  Base mainnet through infrastructure built for exactly this.
                </p>
              </div>
            </Reveal>
            <RevealStagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {STACK.map((s) => (
                <RevealItem key={s.name}>
                  <div className="panel h-full p-5">
                    <div className="font-display text-[15px] font-semibold text-brass">{s.name}</div>
                    <p className="mt-2.5 text-[13px] leading-relaxed text-bone/55">{s.body}</p>
                  </div>
                </RevealItem>
              ))}
            </RevealStagger>
          </div>
        </section>

        <section className="relative overflow-hidden border-t border-bone/[0.06]">
          <div
            className="pointer-events-none absolute left-1/2 top-0 h-[120%] w-[120%] -translate-x-1/2 animate-mesh-drift blur-[130px]"
            style={{ background: "radial-gradient(circle at 50% 30%, rgba(201,164,92,0.16), transparent 60%)" }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage: "radial-gradient(rgba(236,230,216,0.5) 0.7px, transparent 0.7px)",
              backgroundSize: "7px 7px",
            }}
            aria-hidden
          />
          <div className="relative mx-auto max-w-4xl px-6 py-36 text-center">
            <Reveal>
              <div className="mx-auto mb-8 w-fit">
                <SealMark size={56} />
              </div>
              <h2 className="font-display text-4xl font-semibold leading-[1.02] tracking-[-0.01em] text-balance text-bone sm:text-5xl lg:text-6xl">
                Put a crew to work.
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-pretty text-lg text-bone/60">
                Set a budget, write one sentence, and watch a finished piece come back to your wallet.
              </p>
              <div className="mt-10 flex justify-center">
                <Link href="/run" className="btn-primary shine-host h-12 px-7 text-base">
                  Launch the runtime
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        <footer className="relative border-t border-bone/[0.06]">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 text-sm text-slate-dim sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <SealMark size={20} />
              <span>marque, a serverless runtime for agent swarms.</span>
            </div>
            <div className="flex gap-4">
              <Link href="/run" className="transition hover:text-bone">
                launch
              </Link>
              <a
                href="https://github.com/wildanrhmn/marque.run"
                target="_blank"
                rel="noreferrer"
                className="transition hover:text-bone"
              >
                github
              </a>
            </div>
          </div>
        </footer>
      </main>
    </>
  )
}
