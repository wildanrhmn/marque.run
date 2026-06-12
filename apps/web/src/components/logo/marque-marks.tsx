import type { SVGProps } from "react"

export type MarkProps = SVGProps<SVGSVGElement> & { size?: number }

// A — Hallmark Seal: an assay-office ring enclosing a struck M. Heritage / authority.
export function MarkSeal({ size = 24, ...rest }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" aria-hidden {...rest}>
      <circle cx="16" cy="16" r="13.6" strokeWidth="1.4" opacity="0.5" />
      <circle cx="16" cy="16" r="11" strokeWidth="0.7" opacity="0.3" />
      <path d="M10.5 21.5 V12 L16 17.5 L21.5 12 V21.5" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  )
}

// B — Struck Punch: a lozenge punch enclosing an M. Sharp / premium.
export function MarkPunch({ size = 24, ...rest }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" aria-hidden {...rest}>
      <path d="M16 2.5 L29.5 16 L16 29.5 L2.5 16 Z" strokeWidth="1.6" strokeLinejoin="round" opacity="0.55" />
      <path d="M11 20.5 V12.5 L16 17 L21 12.5 V20.5" strokeWidth="2.3" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  )
}

// C — Faceted Marque: a cut-diamond glyph, no letter. Minimal / modern.
export function MarkGem({ size = 24, ...rest }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" aria-hidden {...rest}>
      <path d="M16 3 L28 14.5 L16 29 L4 14.5 Z" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M4 14.5 H28 M16 3 L11.5 14.5 L16 29 M16 3 L20.5 14.5 L16 29" strokeWidth="0.9" opacity="0.5" />
    </svg>
  )
}

// D — Monogram: a standalone struck M. Clean / versatile.
export function MarkMono({ size = 24, ...rest }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" aria-hidden {...rest}>
      <path d="M5 25 V8 L16 19 L27 8 V25" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export const MARKS = [
  {
    id: "seal",
    label: "Hallmark Seal",
    sub: "Assay-office ring around a struck M. Heritage and authority — closest to the seal already in the app.",
    Mark: MarkSeal,
  },
  {
    id: "punch",
    label: "Struck Punch",
    sub: "A lozenge punch enclosing the M, like a silversmith's mark stamped into metal. Sharp and premium.",
    Mark: MarkPunch,
  },
  {
    id: "gem",
    label: "Faceted Marque",
    sub: "A cut-diamond glyph, no letter. Pairs with the wordmark. Minimal and modern.",
    Mark: MarkGem,
  },
  {
    id: "mono",
    label: "Monogram M",
    sub: "A clean standalone M. The most flexible at tiny sizes and as a favicon.",
    Mark: MarkMono,
  },
] as const

export type MarkId = (typeof MARKS)[number]["id"]
