"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown } from "lucide-react"

export type ModeOption<T extends string> = { value: T; label: string }

export function ModeSelect<T extends string>({ value, options, onChange }: { value: T; options: readonly ModeOption<T>[]; onChange: (next: T) => void }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const activeLabel = options.find((option) => option.value === value)?.label ?? ""

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  return (
    <div className="mode-select" ref={rootRef}>
      <button type="button" className="mode-select-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span className="mode-select-label">Mode</span>
        <span className="mode-select-value">{activeLabel}</span>
        <ChevronDown aria-hidden data-open={open} />
      </button>
      {open ? (
        <ul className="mode-select-menu" role="listbox" aria-label="Workspace mode">
          {options.map((option) => (
            <li key={option.value}>
              <button type="button" role="option" aria-selected={option.value === value} className={option.value === value ? "selected" : ""} onClick={() => { onChange(option.value); setOpen(false) }}>
                <span>{option.label}</span>
                {option.value === value ? <Check aria-hidden /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
