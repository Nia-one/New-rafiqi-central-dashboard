import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const root = process.cwd()
const globals = readFileSync(join(root, "app/globals.css"), "utf8")
const dashboard = readFileSync(join(root, "components/nia-dashboard.tsx"), "utf8")
const operationalCard = readFileSync(join(root, "components/operational-card.tsx"), "utf8")
const tokenSelect = readFileSync(join(root, "components/token-select.tsx"), "utf8")

function filesBelow(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? filesBelow(path) : [path]
  })
}

test("the product-wide token contract is present at the global source", () => {
  for (const token of ["color-scheme: light", "--ink: #17191B", "--muted: #6E7378", "--faint: #90959A", "--border: #E1E3E5", "--surface: #FFFFFF", "--bg: #F7F7F8"]) assert.match(globals, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))
  assert.match(globals, /--tracking-heading:\s*-\.012em/)
  assert.match(globals, /--weight-heading:\s*600/)
  assert.match(globals, /\.central-rail[^}]+background:\s*#0(?:9090a|b0b0c)/)
  assert.match(globals, /--nia-blue:\s*#303438/i, "legacy token alias must resolve to neutral charcoal, not blue")
})

test("all application selects use the shared token selector", () => {
  const sourceFiles = filesBelow(join(root, "components")).filter((path) => path.endsWith(".tsx") && !path.endsWith("token-select.tsx"))
  for (const path of sourceFiles) assert.doesNotMatch(readFileSync(path, "utf8"), /<select\b/i, `native select in ${path}`)
  assert.match(tokenSelect, /role="listbox"/)
  assert.match(tokenSelect, /aria-selected=/)
})

test("operational tone is the single status source and renders data-tone", () => {
  assert.match(operationalCard, /export function operationalTone/)
  assert.match(operationalCard, /data-tone=\{tone\}/)
  assert.match(operationalCard, /data-tone=\{meta\.tone\}/)
  for (const tone of ["critical", "breach", "attention", "verified", "neutral"]) assert.match(globals, new RegExp(`--tone-${tone}:`))
})

test("workspace styles do not redefine the core visual system", () => {
  const workspaceStyles = filesBelow(join(root, "components")).filter((path) => path.endsWith("workspace.module.css"))
  for (const path of workspaceStyles) {
    const source = readFileSync(path, "utf8")
    assert.doesNotMatch(source, /--(?:ink|muted|surface|bg|accent):\s*#/i, `local token fork in ${path}`)
    assert.doesNotMatch(source, /font-family:\s*(?:Inter|Helvetica)/i, `local font fork in ${path}`)
    assert.doesNotMatch(source, /font-weight:\s*(?:6[1-9]\d|[789]\d\d)/, `overweight type in ${path}`)
  }
  assert.doesNotMatch(dashboard, /data-theme=/, "route-specific theme fork in the shared shell")
})
