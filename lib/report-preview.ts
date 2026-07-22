type ReportPreviewEnvironment = Readonly<{
  NODE_ENV?: string
  VERCEL_ENV?: string
}>

/**
 * Keep the component harness available to local development and Vercel Preview,
 * while failing closed for Vercel Production and other production runtimes.
 */
export function reportPreviewEnabled(environment: ReportPreviewEnvironment = process.env) {
  return environment.NODE_ENV !== "production" || environment.VERCEL_ENV === "preview"
}
