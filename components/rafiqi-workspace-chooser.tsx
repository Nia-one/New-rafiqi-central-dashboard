"use client"

import { ArrowRight, BarChart3, ClipboardCheck, Route, ShieldCheck } from "lucide-react"

export type RafiqiWorkspace = "chooser" | "insights" | "operations"
export type SelectableWorkspace = Exclude<RafiqiWorkspace, "chooser">

type WorkspaceChooserProps = {
  onSelect: (workspace: SelectableWorkspace) => void
}

const workspaces = [
  {
    id: "insights" as const,
    eyebrow: "Reporting and intelligence",
    title: "Rafiqi Insights",
    description: "See what is happening across Living, Work, and Essentials, then follow every issue through proof and verified closure.",
    icon: BarChart3,
    accent: "var(--interactive-blue-deep)",
    tags: ["Living", "Work", "Essentials"],
  },
  {
    id: "operations" as const,
    eyebrow: "Daily operating system",
    title: "Operations Control Center",
    description: "Turn demand, supply, locations, and open issues into a clear mandate for the people doing the work today.",
    icon: ClipboardCheck,
    accent: "var(--ink)",
    tags: ["Operations Mandate", "Śram Park Scout Route Plan", "Tasks"],
  },
]

export function RafiqiWorkspaceChooser({ onSelect }: WorkspaceChooserProps) {
  return (
    <main className="min-h-screen bg-[var(--canvas)] px-5 py-10 text-[var(--ink)] sm:px-10 sm:py-16">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col justify-between sm:min-h-[calc(100vh-8rem)]">
        <header className="max-w-3xl">
          <div className="mb-7 flex items-center gap-3 text-sm font-semibold tracking-[0.18em] text-[var(--interactive-blue-deep)] uppercase">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-white shadow-sm">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            Rafiqi Central
          </div>
          <p className="mb-4 text-xs font-bold tracking-[0.2em] text-[var(--interactive-blue-deep)] uppercase">Choose your operating view</p>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">One login. Two ways to move the business forward.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--ink-soft)] sm:text-lg">
            Start with the view you need. Insights explains the signal. Operations Control Center turns that signal into a plan for today.
          </p>
        </header>

        <section className="mt-14 grid gap-5 lg:grid-cols-2" aria-label="Rafiqi workspaces">
          {workspaces.map(({ id, eyebrow, title, description, icon: Icon, accent, tags }) => (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className="group flex min-h-[330px] flex-col justify-between rounded-2xl border border-[var(--border)] bg-white p-7 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-1 hover:border-[var(--interactive)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--interactive-hover)] sm:p-9"
            >
              <div>
                <div className="flex items-start justify-between gap-6">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-blue)]" style={{ color: accent }}>
                    <Icon className="h-7 w-7" aria-hidden />
                  </span>
                  <Route className="h-5 w-5 text-[var(--muted)] transition group-hover:translate-x-1 group-hover:text-[var(--interactive-blue-deep)]" aria-hidden />
                </div>
                <p className="mt-10 text-xs font-bold tracking-[0.18em] text-[var(--interactive-blue-deep)] uppercase">{eyebrow}</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">{title}</h2>
                <p className="mt-4 max-w-xl text-base leading-7 text-[var(--ink-soft)]">{description}</p>
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => <span key={tag} className="rounded-full bg-[var(--surface-blue)] px-3 py-1.5 text-xs font-medium text-[var(--ink-soft)]">{tag}</span>)}
                </div>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                  Open view
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden />
                </span>
              </div>
            </button>
          ))}
        </section>

        <footer className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5 text-sm text-[var(--muted)]">
          <span>Rafiqi Central</span>
          <span>Restricted operating data</span>
        </footer>
      </div>
    </main>
  )
}
