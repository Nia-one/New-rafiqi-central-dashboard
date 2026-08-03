import { syncTeamInputs } from "@/lib/teamInputSync";
import { syncEssentialsBotData } from "@/lib/essentialsBotSync";
import { syncShramParkDemandBotData } from "@/lib/shramParkDemandBotSync";
import { syncVerticalInputs } from "@/lib/verticalInputSync";
import { syncMemberFeedback } from "@/lib/memberFeedbackSync";
import { clearSheetCache } from "@/lib/googleSheets";

let activeSync: Promise<SourceSyncReport> | null = null;
let lastSuccessfulSync: SourceSyncReport | null = null;
const SOURCE_SYNC_COOLDOWN_MS = 120_000;

export type SourceSyncReport = {
  report: Awaited<ReturnType<typeof syncTeamInputs>>;
  essentialsReport: Awaited<ReturnType<typeof syncEssentialsBotData>>;
  essentialsSchema: unknown;
  shramParkDemandReport: Awaited<ReturnType<typeof syncShramParkDemandBotData>>;
  shramParkDemandSchema: unknown;
  verticalReport: Awaited<ReturnType<typeof syncVerticalInputs>>;
  memberFeedbackReport: Awaited<ReturnType<typeof syncMemberFeedback>>;
  syncedAt: string;
};

async function runSourceSync(): Promise<SourceSyncReport> {
  // Google Sheets applies a strict per-user read quota. Run the governed
  // connectors sequentially so their internal batch reads do not create one
  // large burst on a serverless cold start.
  const report = await syncTeamInputs();
  const essentialsReport = await syncEssentialsBotData();
  const shramParkDemandReport = await syncShramParkDemandBotData();
  const memberFeedbackReport = await syncMemberFeedback();
  const verticalReport = await syncVerticalInputs();
  // Schemas are provisioned separately; live refresh only moves data. Keeping
  // schema discovery out of this hot path saves dozens of quota-bearing reads.
  const essentialsSchema: unknown = { provisioned: true };
  const shramParkDemandSchema: unknown = { provisioned: true };
  clearSheetCache();
  return { report, essentialsReport, essentialsSchema, shramParkDemandReport, shramParkDemandSchema, verticalReport, memberFeedbackReport, syncedAt: new Date().toISOString() };
}

export function syncAllSources(options: { force?: boolean } = {}) {
  if (activeSync) return activeSync;
  if (!options.force && lastSuccessfulSync && Date.now() - Date.parse(lastSuccessfulSync.syncedAt) < SOURCE_SYNC_COOLDOWN_MS) {
    return Promise.resolve(lastSuccessfulSync);
  }
  activeSync = runSourceSync()
    .then((report) => { lastSuccessfulSync = report; return report; })
    .finally(() => { activeSync = null; });
  return activeSync;
}
