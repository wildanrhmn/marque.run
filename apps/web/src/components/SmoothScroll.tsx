"use client"
import { useEffect } from "react"
import Lenis from "lenis"

export function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.1,
      smoothWheel: true,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    })

    const onAnchor = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('a[href^="/#"], a[href^="#"]')
      if (!target) return
      const href = target.getAttribute("href")
      const hash = href?.includes("#") ? `#${href.split("#")[1]}` : null
      if (!hash || hash === "#") return
      const el = document.querySelector(hash)
      if (el) {
        e.preventDefault()
        lenis.scrollTo(el as HTMLElement, { offset: -90 })
      }
    }
    document.addEventListener("click", onAnchor)

    let raf = 0
    const loop = (time: number) => {
      lenis.raf(time)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener("click", onAnchor)
      lenis.destroy()
    }
  }, [])

  return null
}
