import type { ReportConfig } from "@/lib/report-meaning"

// A self-contained War Room report used ONLY by the dev preview harness. It is
// not wired into any product screen. It exercises every kit feature: the full
// Peak, three quantified action titles, all four evidence exhibits, and both
// static and live data sources.
const NOW = "2026-07-18T12:00:00.000Z"

export const sampleReport: ReportConfig = {
  peak: {
    objective: "Hold blended CM2 above the 22% floor across all Theatres this quarter.",
    situation: "CM2 is tracking at 21.3% blended, 0.7pp under the quarter floor.",
    complication: "South and West Theatres slipped below the 78% occupancy floor for two cycles, and the largest contribution drag is demand-side.",
    recommendation: "Approve the 2-week occupancy recovery playbook for South and West Theatres.",
    ask: "Approve ₹4.2L of recovery spend for South and West before 18:00 today.",
    owner: "Priya · Ops Lead",
    dueDate: "Today 18:00",
    asOf: NOW,
    tone: "breach",
  },
  accordions: [
    {
      id: "restore-occupancy",
      actionTitle: "Restore South Theatre occupancy to the 78% floor within 2 weeks",
      soWhat: "South has been below the floor for two cycles — the single largest drag on blended CM2.",
      tone: "critical",
      owner: "Ops · South",
      dueDate: "Fri 18:00",
      defaultOpen: true,
      evidence: [
        {
          id: "occupancy-headline",
          chartType: "metric",
          dataSource: "static",
          soWhat: "Occupancy fell 6 points while the target held, so the gap is demand-side, not capacity.",
          sourceLabel: "Ops occupancy ledger",
          pulledAt: NOW,
          metrics: [
            { label: "Occupancy", value: "71%", delta: "-6 pts", tone: "critical" },
            { label: "Floor", value: "78%" },
            { label: "CM2 at risk", value: "₹4.2L", tone: "breach" },
          ],
        },
        {
          id: "occupancy-by-nest",
          chartType: "bar",
          dataSource: "static",
          soWhat: "Three nests carry almost the entire South shortfall, so recovery can be targeted.",
          sourceLabel: "Nest occupancy feed",
          pulledAt: NOW,
          tone: "critical",
          series: {
            unit: "%",
            points: [
              { label: "Nest 12", value: 62 },
              { label: "Nest 19", value: 58 },
              { label: "Nest 07", value: 69 },
              { label: "Nest 22", value: 81 },
            ],
          },
        },
      ],
    },
    {
      id: "chase-fill",
      actionTitle: "Chase the 3 overdue fill tasks in West Theatre by Friday",
      soWhat: "The fill deadline passed with no owner response, which is blocking the West recovery.",
      tone: "breach",
      owner: "Ops · West",
      dueDate: "Fri 12:00",
      evidence: [
        {
          id: "fill-shortfall",
          chartType: "table",
          dataSource: "live",
          soWhat: "Two nests carry roughly 80% of the West miss — that is where the chase should start.",
          sourceLabel: "Fill tracker (live)",
          pulledAt: NOW,
          endpoint: "/report-kit-preview/api/pulse?exhibit=fill",
          refreshInterval: 5000,
          table: {
            caption: "West shortfall by nest",
            columns: ["NEST", "TARGET", "ACTUAL", "FILL"],
            rows: [
              ["Nest 12", "40", "22", "55%"],
              ["Nest 19", "35", "18", "51%"],
              ["Nest 07", "30", "27", "90%"],
            ],
          },
        },
      ],
    },
    {
      id: "cut-spend",
      actionTitle: "Cut controllable spend by ₹1.8L to protect the CM2 floor",
      soWhat: "Controllable spend can absorb most of the CM2 gap this week without touching supply.",
      tone: "attention",
      owner: "Finance · Nia",
      dueDate: "Wed",
      evidence: [
        {
          id: "cm2-trend",
          chartType: "line",
          dataSource: "static",
          soWhat: "CM2 has fallen four weeks running and is now under the floor — the trend, not a blip.",
          sourceLabel: "Finance CM2 model",
          pulledAt: NOW,
          series: {
            unit: "%",
            points: [
              { label: "W1", value: 23.1 },
              { label: "W2", value: 22.6 },
              { label: "W3", value: 21.9 },
              { label: "W4", value: 21.3 },
            ],
          },
        },
        {
          id: "spend-live",
          chartType: "metric",
          dataSource: "live",
          soWhat: "Controllable spend is still running hot against pace; this updates as the ledger posts.",
          sourceLabel: "Spend ledger (live)",
          pulledAt: NOW,
          endpoint: "/report-kit-preview/api/pulse?exhibit=spend",
          refreshInterval: 5000,
          metrics: [
            { label: "Spend vs pace", value: "+₹1.8L", tone: "attention" },
            { label: "Recoverable", value: "₹1.8L" },
          ],
        },
      ],
    },
  ],
}
