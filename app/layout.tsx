import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import Script from "next/script"
import "./globals.css"
import "../components/decision-room.css"
import "../components/despatch-screen.css"
import "../components/central-sidebar.css"

export const metadata: Metadata = { title: "RafiQi Central", description: "Nia's secure operating control center for Living, Work and Essentials." }
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0B0E14" },
    { media: "(prefers-color-scheme: light)", color: "#F6F8FB" },
  ],
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const themeScript = "try{var t=localStorage.getItem('nia-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}"
  return (
    <html lang="en" className="bg-background" suppressHydrationWarning>
      <body>
        <Script id="nia-theme-bootstrap" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
        {process.env.VERCEL === "1" ? <Analytics /> : null}
      </body>
    </html>
  )
}
