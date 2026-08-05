import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const layoutSource = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8")
// Inspect only the rendered JSX (after `return (`), so explanatory comments above it that
// mention markup like the head element do not create false matches.
const layout = layoutSource.slice(layoutSource.indexOf("return ("))

// Regression guard for the /login (and every route) hydration error caused by v0's sandbox
// injecting its own script into the first inline <head> script slot, overwriting our theme
// bootstrap's content on the server while the client still expected the theme function.

test("the theme bootstrap is an inline script, kept out of <head>", () => {
  // The script must still exist (flash-free pre-paint theming) and stay inline.
  assert.match(layoutSource, /id="nia-theme-bootstrap"/, "theme bootstrap script is present")
  assert.match(layoutSource, /setAttribute\('data-theme'/, "theme bootstrap still drives data-theme")
  // No manual <head> element in the JSX at all — that is where the collision happened.
  assert.doesNotMatch(layout, /<head\b/, "layout must not render a manual <head> that hosts the first inline script")
})

test("the theme bootstrap renders as the first child of <body>, before children", () => {
  const bodyOpen = layout.indexOf("<body")
  const scriptAt = layout.indexOf("nia-theme-bootstrap")
  const childrenAt = layout.indexOf("{children}")
  assert.ok(bodyOpen !== -1 && scriptAt !== -1 && childrenAt !== -1, "body, script and children are all present")
  assert.ok(scriptAt > bodyOpen, "theme script is inside <body>")
  assert.ok(scriptAt < childrenAt, "theme script runs before children so the theme is applied first")
})

test("<html> keeps suppressHydrationWarning for the script-driven data-theme attribute", () => {
  // The script mutates data-theme on <html> before hydration; the attribute diff on <html>
  // is expected and suppressed here. (This never suppressed the child <script> __html diff,
  // which is exactly why the script had to leave <head>.)
  assert.match(layout, /<html[^>]*suppressHydrationWarning/, "html retains suppressHydrationWarning")
})
