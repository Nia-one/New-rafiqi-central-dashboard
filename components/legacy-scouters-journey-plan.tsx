"use client"

import { useMemo, useState } from "react"
import {
  CheckCircle2,
  CircleDot,
  MapPinned,
  Route,
  Target,
  TimerReset,
  UsersRound,
} from "lucide-react"

type Radius = "2 km" | "5 km" | "15 km"

const radiusBands: Array<{ radius: Radius; count: string; note: string; tone: string }> = [
  { radius: "2 km", count: "4", note: "Immediate enterprise context", tone: "border-cyan-300/30 bg-cyan-300/[0.08] text-cyan-100" },
  { radius: "5 km", count: "8", note: "Primary scouting route", tone: "border-blue-300/30 bg-blue-300/[0.08] text-blue-100" },
  { radius: "15 km", count: "13", note: "Wider supply and demand scan", tone: "border-violet-300/30 bg-violet-300/[0.08] text-violet-100" },
]

const mandateItems = [
  { id: "demand", label: "Validate demand anchors", detail: "Confirm named enterprises and workforce demand around the active location.", owner: "Scouter", due: "Today · 11:30", status: "In progress" },
  { id: "supply", label: "Shortlist studio supply", detail: "Identify viable PG and property conversion candidates in the 2 km and 5 km bands.", owner: "Property scout", due: "Today · 14:00", status: "Queued" },
  { id: "route", label: "Publish the field route", detail: "Turn verified context into an ordered route with evidence required at each stop.", owner: "JCO", due: "Today · 16:30", status: "Ready" },
]

export function LegacyScoutersJourneyPlan() {
  const [activeRadius, setActiveRadius] = useState<Radius>("5 km")
  const activeBand = useMemo(
    () => radiusBands.find((band) => band.radius === activeRadius) ?? radiusBands[1],
    [activeRadius],
  )

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-700/70 bg-slate-950/50 p-6 shadow-[0_18px_50px_rgba(2,6,23,0.28)]">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              <Route className="size-4" aria-hidden />
              Scouter's Journey Plan · SJP
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
              Turn a location into a verified field route.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Start with the demand signal, map supply around it, and leave every stop with a named
              next action. This is the operating layer behind the reporting view.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.07] px-4 py-3">
            <CheckCircle2 className="size-5 text-emerald-300" aria-hidden />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200/70">Plan status</p>
              <p className="mt-1 text-sm font-semibold text-emerald-100">Ready for field planning</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.8fr)]">
        <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Active anchor</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-100">TVS Logistics Park · Sriperumbudur</h3>
              <p className="mt-1 text-xs text-slate-400">Demand-led scouting lens · Coromandel Theatre</p>
            </div>
            <MapPinned className="size-5 text-cyan-300" aria-hidden />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {radiusBands.map((band) => (
              <button
                key={band.radius}
                type="button"
                onClick={() => setActiveRadius(band.radius)}
                className={`rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-500 ${activeRadius === band.radius ? band.tone : "border-slate-800 bg-slate-900/60 text-slate-300"}`}
                aria-pressed={activeRadius === band.radius}
              >
                <span className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.14em]">
                  {band.radius}
                  <CircleDot className="size-4" aria-hidden />
                </span>
                <strong className="mt-3 block text-2xl font-semibold">{band.count}</strong>
                <span className="mt-1 block text-xs opacity-70">{band.note}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Current radius brief</p>
                <p className="mt-1 text-sm font-medium text-slate-200">{activeBand.note}</p>
              </div>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">{activeBand.radius} lens</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
              <span className="block h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400" style={{ width: activeRadius === "2 km" ? "35%" : activeRadius === "5 km" ? "62%" : "92%" }} />
            </div>
          </div>
        </section>

        <aside className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Route brief</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-100">Today's mandate</h3>
            </div>
            <Target className="size-5 text-amber-300" aria-hidden />
          </div>
          <div className="mt-5 space-y-4">
            <div className="flex items-start gap-3">
              <UsersRound className="mt-0.5 size-4 text-cyan-300" aria-hidden />
              <div>
                <p className="text-xs font-semibold text-slate-200">Demand first</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Start with the enterprises that can fill future studio capacity.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPinned className="mt-0.5 size-4 text-blue-300" aria-hidden />
              <div>
                <p className="text-xs font-semibold text-slate-200">Supply second</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Search for viable PG and studio supply inside the chosen radius.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <TimerReset className="mt-0.5 size-4 text-violet-300" aria-hidden />
              <div>
                <p className="text-xs font-semibold text-slate-200">Close with proof</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Every stop ends with evidence, owner, and next review time.</p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Action queue</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-100">Move the route from context to closure.</h3>
          </div>
          <span className="text-xs text-slate-500">3 actions · one operating owner each</span>
        </div>
        <div className="mt-5 grid gap-3">
          {mandateItems.map((item, index) => (
            <article key={item.id} className="grid gap-4 rounded-xl border border-slate-800 bg-slate-900/55 p-4 md:grid-cols-[42px_minmax(0,1fr)_170px_110px] md:items-center">
              <span className="text-sm font-semibold text-slate-600">0{index + 1}</span>
              <div>
                <h4 className="text-sm font-semibold text-slate-100">{item.label}</h4>
                <p className="mt-1 text-xs leading-5 text-slate-400">{item.detail}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">Owner · due</p>
                <p className="mt-1 text-xs text-slate-300">{item.owner} · {item.due}</p>
              </div>
              <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${item.status === "In progress" ? "bg-cyan-300/10 text-cyan-200" : item.status === "Ready" ? "bg-emerald-300/10 text-emerald-200" : "bg-slate-800 text-slate-400"}`}>
                {item.status}
              </span>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
