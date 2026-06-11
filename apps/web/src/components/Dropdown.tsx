"use client"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { cn } from "@/lib/cn"

export interface DropdownOption {
  id: string
  label: string
}

export function Dropdown({
  value,
  options,
  onChange,
  className,
  width = 168,
}: {
  value: string
  options: DropdownOption[]
  onChange: (v: string) => void
  className?: string
  width?: number
}) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const place = () => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setCoords({ top: r.bottom + 6, left: r.left })
  }

  useLayoutEffect(() => {
    if (open) place()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return
      place()
    }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    window.addEventListener("scroll", onScroll, true)
    window.addEventListener("resize", onScroll)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("resize", onScroll)
    }
  }, [open])

  const current = options.find((o) => o.id === value)

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border bg-bone/[0.02] px-2.5 py-1.5 text-[11px] font-medium text-bone transition",
          open ? "border-brass/40" : "border-bone/[0.07] hover:border-brass/30",
        )}
        style={{ minWidth: width }}
      >
        <span className="flex-1 truncate text-left">{current?.label ?? "Select"}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={cn("shrink-0 text-slate transition-transform duration-200", open && "rotate-180")}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {mounted
        ? createPortal(
            <AnimatePresence>
              {open && coords ? (
                <motion.div
                  ref={menuRef}
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                  className="fixed z-[100] max-h-60 overflow-y-auto rounded-xl border border-bone/10 bg-ink-900/95 p-1 shadow-2xl backdrop-blur-xl"
                  style={{ top: coords.top, left: coords.left, width, transformOrigin: "top" }}
                >
                  {options.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => {
                        onChange(o.id)
                        setOpen(false)
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] transition",
                        o.id === value
                          ? "bg-brass/15 text-brass"
                          : "text-bone/70 hover:bg-bone/[0.05] hover:text-bone",
                      )}
                    >
                      <span className="truncate">{o.label}</span>
                      {o.id === value ? (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M5 12l4 4L19 6" />
                        </svg>
                      ) : null}
                    </button>
                  ))}
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </div>
  )
}
