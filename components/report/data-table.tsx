import type { ReportTable } from "@/lib/report-meaning"
import { DataTable as BaseDataTable } from "@/components/data-table"

// Wraps the product-wide table (numeric alignment, no-data styling, a11y caption)
// so the report kit reuses one table implementation. Meaning is owned by the
// parent EvidenceBlock's "So What" gate; here we only surface the caption.
export function DataTable({ table, className = "" }: { table: ReportTable; className?: string }) {
  return (
    <div className="report-table">
      <p className="report-table-caption">{table.caption}</p>
      <BaseDataTable
        columns={[...table.columns]}
        rows={table.rows.map((row) => [...row])}
        caption={table.caption}
        className={className}
      />
    </div>
  )
}
