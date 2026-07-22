import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import "./globals.css"

export const metadata: Metadata = { title: "Rafiqi Central", description: "Nia's secure operating control center for Living, Work and Essentials." }
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0B0E14" },
    { media: "(prefers-color-scheme: light)", color: "#F6F8FB" },
  ],
  width: "device-width",
  initialScale: 1,
}

// Applies the saved theme (or the OS preference) before first paint to avoid a flash.
// This is rendered as the FIRST child of <body>, never in <head>: v0's sandbox injects
// its own script into the first inline <head> script slot, which would overwrite this
// script's content on the server and trip a hydration mismatch that suppressHydrationWarning
// on <html> cannot cover (it does not suppress a child script's __html). Kept in <body>, the
// script's content is byte-identical on server and client, and a synchronous parse-time body
// script still runs before first paint, so theming stays flash-free.
const themeScript = `(function(){try{var t=localStorage.getItem('nia-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="bg-background" suppressHydrationWarning>
      <body>
        <script id="nia-theme-bootstrap" dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
        {process.env.VERCEL === "1" ? <Analytics /> : null}
      </body>
    </html>
  )
}
