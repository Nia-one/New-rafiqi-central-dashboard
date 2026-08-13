const numericColumns = new Set([
  "ACTUAL",
  "AGEING",
  "AOV",
  "ARPU",
  "ATTACH",
  "AVAILABLE",
  "BUYERS",
  "CHURN",
  "CM",
  "CM1",
  "CM2",
  "D30",
  "D60",
  "D90",
  "DAYS COVER",
  "DAYS LIVE",
  "CONTRACTED",
  "ELIGIBLE",
  "FILL",
  "FREQUENCY",
  "GMV",
  "MEMBERS",
  "MRP",
  "NESTS",
  "OCCUPANCY",
  "OCCUPIED",
  "ORDERS",
  "PACE",
  "PRODUCTS / MEMBER",
  "REPEAT",
  "SAVINGS",
  "SELLING",
  "STOCKOUT",
  "TARGET",
  "UNITS",
  "VALUE",
  "VACANT",
  "ZERO SALE",
])

export function isNumericColumn(label: string) {
  return numericColumns.has(label.trim().toUpperCase())
}

export function DataTable({ columns, rows, className = "", caption }: { columns: string[]; rows: string[][]; className?: string; caption?: string }) {
  return <div className={`table-wrap ${className}`.trim()}><table>
    {caption && <caption className="sr-only">{caption}</caption>}
    <thead><tr>{columns.map((column) => <th className={isNumericColumn(column) ? "numeric" : undefined} scope="col" key={column}>{column}</th>)}</tr></thead>
    <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => {
      const classes = [cellIndex === 0 ? "first" : "", isNumericColumn(columns[cellIndex] ?? "") ? "numeric" : "", cell.includes("No data") ? "no-data" : "", cell.startsWith("+₹") ? "signed-positive" : "", cell.startsWith("−₹") || cell.startsWith("-₹") ? "signed-negative" : ""].filter(Boolean).join(" ")
      const content = (columns[cellIndex] ?? "").trim().toUpperCase() === "CM"
        ? <span className="metric-value-pill">{cell}</span>
        : cell
      return <td className={classes || undefined} key={cellIndex}>{content}</td>
    })}</tr>)}</tbody>
  </table></div>
}
