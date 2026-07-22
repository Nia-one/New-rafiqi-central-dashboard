"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Check, ChevronDown } from "lucide-react"

export type TokenSelectOption<T extends string> = Readonly<{ value: T; label?: string }>

export function TokenSelect<T extends string>({ ariaLabel, value, options, onChange, disabled = false, className = "" }: {
  ariaLabel: string
  value: T
  options: readonly (T | TokenSelectOption<T>)[]
  onChange: (value: T) => void
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const normalized = options.map((option) => typeof option === "string" ? { value: option, label: option } : { value: option.value, label: option.label ?? option.value })
  const active = normalized.find((option) => option.value === value) ?? normalized[0]

  useEffect(() => {
    if (!open) return
    function dismiss(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", dismiss)
    document.addEventListener("keydown", closeOnEscape)
    return () => {
      document.removeEventListener("pointerdown", dismiss)
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [open])

  return <div className={`token-select ${className}`.trim()} ref={rootRef}>
    <button type="button" className="token-select-trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={listboxId} disabled={disabled} onClick={() => setOpen((current) => !current)}>
      <span>{active?.label ?? value}</span><ChevronDown aria-hidden data-open={open} />
    </button>
    <ul className="token-select-menu" id={listboxId} role="listbox" aria-label={ariaLabel} hidden={!open || disabled}>
      {normalized.map((option) => <li key={option.value}>
        <button type="button" role="option" aria-selected={option.value === value} data-selected={option.value === value || undefined} onClick={() => { onChange(option.value); setOpen(false) }}>
          <span>{option.label}</span>{option.value === value ? <Check aria-hidden /> : null}
        </button>
      </li>)}
    </ul>
  </div>
}
