export type MemberAddsDecisionInputs = { gap: number; target: number; current: number; openSignOff: number; owner: string }

export function memberAddsDecisionCopy({ gap, target, current, openSignOff, owner }: MemberAddsDecisionInputs) {
  if (gap > 0 && openSignOff > 0) return {
    label: "Decision required", headline: `Clear ${openSignOff} blocked sign-off${openSignOff === 1 ? "" : "s"} and recover ${gap.toLocaleString("en-IN")} verified Member addition${gap === 1 ? "" : "s"}.`,
    explanation: `Each recovery requires billing-live proof; accountability remains with ${owner} until the target is achieved.`, ownerLabel: "Owner", doneLabel: "Done when", doneWhen: `${target.toLocaleString("en-IN")} verified additions achieved · gap reaches 0`,
  }
  if (gap > 0) return {
    label: "Decision required", headline: `Recover ${gap.toLocaleString("en-IN")} verified Member addition${gap === 1 ? "" : "s"} to achieve the monthly target of ${target.toLocaleString("en-IN")}.`,
    explanation: `Each addition requires billing-live proof; accountability remains with ${owner} until the target is achieved.`, ownerLabel: "Owner", doneLabel: "Done when", doneWhen: `${target.toLocaleString("en-IN")} verified additions achieved · gap reaches 0`,
  }
  if (openSignOff > 0) return {
    label: "Decision required", headline: `Clear ${openSignOff} blocked sign-off${openSignOff === 1 ? "" : "s"}; the monthly Member Adds target is already achieved.`,
    explanation: `${owner} owns the remaining governed sign-off${openSignOff === 1 ? "" : "s"}.`, ownerLabel: "Owner", doneLabel: "Done when", doneWhen: "All blocked sign-offs are cleared",
  }
  return {
    label: "No decision required", headline: `Target achieved: ${current.toLocaleString("en-IN")} of ${target.toLocaleString("en-IN")} verified billing-live additions are complete.`,
    explanation: `No recovery action or sign-off is currently required. ${owner} remains the monitoring owner.`, ownerLabel: "Monitoring owner", doneLabel: "Status", doneWhen: `${current.toLocaleString("en-IN")}/${target.toLocaleString("en-IN")} verified · complete`,
  }
}
