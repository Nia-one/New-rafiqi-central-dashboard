type PolicyRow = Record<string, unknown>

const text = (row: PolicyRow, key: string) => String(row[key] ?? "").trim()

export function selectApprovedMarginTarget(policies: readonly PolicyRow[]) {
  return policies
    .filter((row) => {
      const policyId = text(row, "policy id")
      const descriptor = `${policyId} ${text(row, "policy name")} ${text(row, "source note")}`.toLowerCase()
      return !/^sample[-_]/i.test(policyId)
        && /margin|cm2/.test(descriptor)
        && /full.?use|target|control/.test(descriptor)
        && text(row, "status").toLowerCase() === "approved"
    })
    .sort((left, right) => {
      const score = (row: PolicyRow) => {
        const descriptor = `${text(row, "policy id")} ${text(row, "policy name")} ${text(row, "source note")}`.toLowerCase()
        const updatedAt = Date.parse(text(row, "updated at")) || Date.parse(text(row, "effective from")) || 0
        return (descriptor.includes("nia margins") ? 10_000 : 0)
          + (/full.?use/.test(descriptor) ? 5_000 : 0)
          + (/target|control/.test(descriptor) ? 1_000 : 0)
          + updatedAt / 1e12
      }
      return score(right) - score(left)
    })[0]
}
