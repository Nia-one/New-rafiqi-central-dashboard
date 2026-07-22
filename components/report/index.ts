// Report Meaning Layer — public component API.
// A reusable collapsible-pyramid kit: Peak → Action Accordions → Evidence.
export { ReportHeader } from "./report-header"
export { ActionAccordion, ActionAccordionStack } from "./action-accordion"
export { EvidenceBlock } from "./evidence-block"
export { MetricCard, MetricGrid } from "./metric-card"
export { DataTable } from "./data-table"
export { BarChart, LineChart } from "./charts"
export type {
  ReportConfig,
  ReportPeak,
  ReportAccordion,
  ReportEvidence,
  ReportMetric,
  ReportTable,
  ReportChartPoint,
  ReportChartSeries,
  ReportTone,
  EvidenceDataSource,
  EvidenceChartType,
} from "@/lib/report-meaning"
export {
  buildReport,
  isActionTitle,
  describeTitleIssue,
  assertSoWhat,
  readThrough,
  REPORT_ACTION_VERBS,
} from "@/lib/report-meaning"
