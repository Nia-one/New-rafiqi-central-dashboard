export type DashboardContentRow = {
  workspace: string
  page: string
  component: string
  key: string
  value: string
  format: string
  owner: string
  sourceTab: string
  updatedAt: string
}

export type DashboardContent = ReadonlyMap<string, DashboardContentRow>

const normalise = (value: unknown) => String(value ?? "").trim()

export function dashboardContentKey(page: string, component: string, key: string) {
  return `${page.toLowerCase()}|${component.toLowerCase()}|${key.toLowerCase()}`
}

/** Converts the ops-owned Dashboard_Content tab into a fast lookup for the UI. */
export function parseDashboardContent(rows: readonly (readonly unknown[])[]): DashboardContent {
  if (rows.length < 2) return new Map()
  const headers = rows[0].map((header) => normalise(header).toLowerCase().replaceAll(" ", "_"))
  const indexOf = (name: string) => headers.indexOf(name)
  const read = (row: readonly unknown[], name: string) => {
    const index = indexOf(name)
    return index === -1 ? "" : normalise(row[index])
  }
  const content = new Map<string, DashboardContentRow>()
  for (const row of rows.slice(1)) {
    const entry: DashboardContentRow = {
      workspace: read(row, "workspace"), page: read(row, "page"), component: read(row, "component"), key: read(row, "key"), value: read(row, "value"), format: read(row, "format"), owner: read(row, "owner"), sourceTab: read(row, "source_tab"), updatedAt: read(row, "last_updated"),
    }
    if (entry.page && entry.component && entry.key && entry.value) content.set(dashboardContentKey(entry.page, entry.component, entry.key), entry)
  }
  return content
}

export function contentValue(content: DashboardContent | readonly DashboardContentRow[] | undefined, page: string, component: string, key: string, fallback: string) {
  if (!content) return fallback
  if (Array.isArray(content)) {
    return content.find((row) => row.page.toLowerCase() === page.toLowerCase() && row.component.toLowerCase() === component.toLowerCase() && row.key.toLowerCase() === key.toLowerCase())?.value || fallback
  }
  return (content as DashboardContent).get(dashboardContentKey(page, component, key))?.value || fallback
}
