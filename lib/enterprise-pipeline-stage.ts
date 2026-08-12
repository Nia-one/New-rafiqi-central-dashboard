export const ENTERPRISE_PIPELINE_STAGES = [
  "Compaign",
  "Lead",
  "Interested",
  "Proposal Sent",
  "Contracting",
  "Contracted",
] as const

export type EnterprisePipelineStage = (typeof ENTERPRISE_PIPELINE_STAGES)[number]

/** Returns null for blank or unknown source values so they are never silently counted as leads. */
export function enterprisePipelineStage(...values: unknown[]): EnterprisePipelineStage | null {
  const state = values.map((value) => String(value ?? "")).join(" ").toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ").trim()
  if (!state) return null
  if (/drop|dropped|lost|reject|cancel|closed/.test(state)) return null
  if (/compaign|campaign/.test(state)) return "Compaign"
  if (/proposal|propsal|propsaal|quote/.test(state)) return "Proposal Sent"
  if (/contracted|onboard|agreement signed|contract signed|\bwon\b|\blive\b/.test(state)) return "Contracted"
  if (/contracting|negotiat|contract review|commercial/.test(state)) return "Contracting"
  if (/interest/.test(state)) return "Interested"
  if (/\blead\b/.test(state)) return "Lead"
  return null
}
