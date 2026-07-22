import { buildOpsData } from "./opsDataMapper";
import type { MismatchInput } from "./allocation-types";
import type { SupplyOption } from "./allocation-data";

export type LiveAllocationData = {
  mismatchInputs: MismatchInput[];
  supplyOptions: SupplyOption[];
};

export async function buildAllocationData(): Promise<LiveAllocationData> {
  const ops = await buildOpsData();

  const mismatchInputs: MismatchInput[] = (ops.constraints ?? []).map(
    (item: any) => ({
      id: item.id,
      domain: item.lane || "Unknown",
      mismatchType: "constraint",
      theatre: item.where || "Unknown",
      where: item.where || "",
      label: item.title,
      joinKey: {
        theatreId: item.where || "",
      },

      demandQty: 0,
      supplyQty: 0,
      gapQty: 0,
      gapUnit: "",

      ageHours: 0,
      thresholdHours: 0,
      deadlineAt: "",

      forwardCmAtRisk24h: item.impact || 0,
      recoverableShare: 0,
      confidence: "Medium",

      sourceUpdatedAt: ops.meta.updatedAt,
      sourceLabel: "Google Sheet constraints",

      accountableOwner: item.owner || "",
      actionStatus: "Detected",
      actionTemplateId: "constraint",

      laneTarget: {
        screen: item.lane || "Overview",
      },

      evidence: [
        item.detail || "Live constraint from Google Sheet"
      ],

      rootCauseAnalysis: {
        whys: [
          item.detail || "Constraint identified from live data"
        ],
        rootCause:
          item.title || "Operational constraint",
        recommendedSolution:
          item.next || "Review and resolve constraint",
        evidenceReferences: [
          "Google Sheet constraints"
        ],
      },
    })
  );

  const supplyOptions: SupplyOption[] = [];

  return {
    mismatchInputs,
    supplyOptions,
  };
}





