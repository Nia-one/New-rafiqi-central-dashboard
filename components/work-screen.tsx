import { BriefcaseBusiness, Database } from "lucide-react"
import { DashboardSectionAccordion } from "@/components/dashboard-section-accordion"
import { WORK_EMPTY_STATE } from "@/lib/dashboard-model"

export function WorkScreen() {
  return <DashboardSectionAccordion className="work-screen" ariaLabel="Work sections" sections={[{ title: "Work data requirement", summary: WORK_EMPTY_STATE.title }]}><div className="work-empty"><BriefcaseBusiness aria-hidden /><p className="pillar-kicker">WORK · DATA REQUIREMENT</p><h2 id="work-title">{WORK_EMPTY_STATE.title}</h2><p>{WORK_EMPTY_STATE.description}</p><div className="required-fields"><div><Database aria-hidden /><strong>Required source fields</strong></div><ul>{WORK_EMPTY_STATE.fields.map((field) => <li key={field}>{field}</li>)}</ul></div></div></DashboardSectionAccordion>
}
