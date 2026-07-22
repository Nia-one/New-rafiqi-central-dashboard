// Derives a small inline visualization from the pre-formatted measure strings
// used across the operating-loop workspaces. Returns null when the value/target
// pair cannot be expressed as a chart, so callers can fall back to the number.

export type MeasureViz =
  | { kind: "fraction"; fillPct: number; caption: string }
  | { kind: "compare"; fillPct: number; markerPct: number; caption: string }

function firstNumber(input: string | undefined): number | null {
  if (!input) return null
  // Strip grouping commas so "1,435" parses as 1435, then take the first signed decimal.
  const match = input.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const value = Number.parseFloat(match[0])
  return Number.isFinite(value) ? value : null
}

// "11/14", "7 / 18" → { numerator, denominator }
function fraction(input: string): { numerator: number; denominator: number } | null {
  const match = input.match(/(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/)
  if (!match) return null
  const numerator = Number.parseFloat(match[1])
  const denominator = Number.parseFloat(match[2])
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null
  return { numerator, denominator }
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

// A value-vs-reference comparison is only meaningful when both sides share a unit.
// Percent ("64%" vs "65% floor") and currency ("₹1435" vs "₹1500 control") compare;
// bare counts with different nouns ("2 open" vs "2 verified") do not.
function comparableUnit(value: string, target: string): boolean {
  if (value.includes("%") && target.includes("%")) return true
  const currency = /[₹$€£]/
  return currency.test(value) && currency.test(target)
}

export function measureViz(value: string, target: string): MeasureViz | null {
  // A ratio in the value ("11/14") is a self-contained composition; the target is context text.
  const ratio = fraction(value)
  if (ratio) {
    return { kind: "fraction", fillPct: clamp((ratio.numerator / ratio.denominator) * 100), caption: target.trim() || `${ratio.numerator} of ${ratio.denominator}` }
  }

  // Otherwise, if value and target share a unit and both carry a number, draw value vs reference.
  if (!comparableUnit(value, target)) return null
  const current = firstNumber(value)
  const reference = firstNumber(target)
  if (current === null || reference === null || current < 0 || reference <= 0) return null
  const scale = Math.max(current, reference) * 1.25
  if (scale <= 0) return null
  return { kind: "compare", fillPct: clamp((current / scale) * 100), markerPct: clamp((reference / scale) * 100), caption: target }
}
