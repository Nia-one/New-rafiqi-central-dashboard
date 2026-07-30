import dotenv from "dotenv";
import { syncMemberFeedback } from "../lib/memberFeedbackSync";

dotenv.config({ path: ".env.local" });
syncMemberFeedback()
  .then((report) => console.log(JSON.stringify(report, null, 2)))
  .catch((error) => { console.error(error); process.exitCode = 1; });
