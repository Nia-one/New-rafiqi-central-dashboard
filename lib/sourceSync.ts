import { syncTeamInputs } from "@/lib/teamInputSync";
import { ensureEssentialsBotSchema, syncEssentialsBotData } from "@/lib/essentialsBotSync";
import { ensureShramParkDemandBotSchema, syncShramParkDemandBotData } from "@/lib/shramParkDemandBotSync";
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
  const [report, essentialsReport, shramParkDemandReport, memberFeedbackReport] = await Promise.all([
    syncTeamInputs(),
    syncEssentialsBotData(),
    syncShramParkDemandBotData(),
    syncMemberFeedback(),
  ]);
  const verticalReport = await syncVerticalInputs();
  let essentialsSchema: unknown;
  try { essentialsSchema = await ensureEssentialsBotSchema(); }
  catch (error) { essentialsSchema = { pendingEditorAccess: true, error: error instanceof Error ? error.message : "Unknown error" }; }
  let shramParkDemandSchema: unknown;
  try { shramParkDemandSchema = await ensureShramParkDemandBotSchema(); }
  catch (error) { shramParkDemandSchema = { pendingEditorAccess: true, error: error instanceof Error ? error.message : "Unknown error" }; }
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
