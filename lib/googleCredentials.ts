import fs from "fs";
import path from "path";

export function googleServiceAccountCredentials() {
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (inline) return JSON.parse(inline);

  const configured = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "service-account.json";
  try {
    return JSON.parse(configured);
  } catch {
    return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), configured), "utf8"));
  }
}
