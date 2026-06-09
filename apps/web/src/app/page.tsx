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
