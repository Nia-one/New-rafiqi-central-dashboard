import type {
  LivingCapacityRow,
  FonoCapacityRow,
  SpCapacityRow,
  LivingCapacityLineage,
} from "@/lib/operating-loop/living-supply-model"

function n(value: unknown): number {
  return Number(value ?? 0)
}

function createLineage(studioId: string): LivingCapacityLineage {
  return {
    studioMasterRowIdentity: studioId,
    livingRowIdentity: studioId,
    sourceName: "Google Sheets",
    asOf: new Date().toISOString(),
    synthetic: false,
  }
}

export function buildLivingCapacityRows(
  liveOpsData: any
): LivingCapacityRow[] {
  const living = liveOpsData?.living ?? []
const finance = liveOpsData?.finance ?? []
const studios = liveOpsData?.studios ?? []

return living.map((row: any) => {
    const studio =
        studios.find(
            (s: any) =>
                s["studio id"] === row["studio id"]
        ) ?? {}

    const fin =
        finance.find(
            (f: any) =>
                f["theatre id"] === row["theatre id"]
        ) ?? {}

    const base = {
        studioId: row["studio id"],

        studioName:
            studio["studio name"] ??
            row["studio id"],

        theatreId: row["theatre id"],

        supplyModel:
            row["supply model"],

        contractedNests: n(
            row["contracted nests"]
        ),

        activationReadyNests: n(
            row["activation ready nests"]
        ),

        occupiedNests: n(
            row["occupied nests"]
        ),

        payingNests: n(
            row["occupied nests"]
        ),

        billedLivingRevenueInr: n(
            row["living billed inr"]
        ),

        verifiedCollectionsInr: n(
            row["living collected inr"]
        ),

        cm1Inr: n(fin["cm1 inr"]),

        cm1DefinitionRef: "Finance_Daily.cm1",

        cm2Inr: n(fin["cm2 inr"]),

        cm2DefinitionRef: "Finance_Daily.cm2",

        lineage: createLineage(
            row["studio id"]
        ),
    }

    if (
        row["supply model"] === "SP"
    ) {
        return {
            ...base,

            supplyModel: "SP",

            enterpriseDemandNests: 0,

            enterpriseContractCoveredNests: 0,

            capexExposureInr: 0,

            blockingMilestone:
                row["primary blocker"] ??
                null,

            readiness: {
                buildOut: "No data",

                hardwareAmenities: "No data",

                sukh: "No data",

                ufd: "No data",
            },
        }
    }

    return {
        ...base,

        supplyModel: "FONO",

        franchiseeSourcedMembers: 0,

        niaFilledMembers: n(
            row["occupied nests"]
        ),

        vacantNestsAtCycleStart:
            n(row["activation ready nests"]) -
            n(row["occupied nests"]),
    }
})
}