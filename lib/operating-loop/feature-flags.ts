type FeatureEnvironment = Record<string, string | undefined>

export function selfDrivePlatformEnabled(environment: FeatureEnvironment = process.env) {
  const explicitValue = environment.RAFIQI_SELF_DRIVE_PLATFORM?.trim().toLowerCase()
  if (explicitValue !== undefined) return explicitValue === "true"

  const isIsolatedDevelopmentPreview = environment.NODE_ENV !== "production"
    && !environment.RAFIQI_LOGIN_EMAIL
    && !environment.RAFIQI_LOGIN_PASSWORD
    && !environment.RAFIQI_SESSION_SECRET

  return isIsolatedDevelopmentPreview
}

/** @deprecated The complete platform is released only through RAFIQI_SELF_DRIVE_PLATFORM. */
export function closedLoopDemandActivationEnabled(environment: FeatureEnvironment = process.env) {
  return selfDrivePlatformEnabled(environment)
}

export function financeExpansionControlEnabled(environment: FeatureEnvironment = process.env) {
  return environment.RAFIQI_FINANCE_EXPANSION_CONTROL?.trim().toLowerCase() === "true"
}

/** @deprecated The complete platform is released only through RAFIQI_SELF_DRIVE_PLATFORM. */
export function remainingDomainControlEnabled(environment: FeatureEnvironment = process.env) {
  return selfDrivePlatformEnabled(environment)
}

/** @deprecated The complete platform is released only through RAFIQI_SELF_DRIVE_PLATFORM. */
export function controlledAutonomyEvaluationEnabled(environment: FeatureEnvironment = process.env) {
  return selfDrivePlatformEnabled(environment)
}

export function operatingDataLiveReadsEnabled(environment: FeatureEnvironment = process.env) {
  return environment.RAFIQI_OPERATING_DATA_LIVE_READS?.trim().toLowerCase() === "true"
}

export function whatsappOperatingWritesEnabled(environment: FeatureEnvironment = process.env) {
  return environment.RAFIQI_WHATSAPP_OPERATING_WRITES?.trim().toLowerCase() === "true" && environment.NODE_ENV !== "production"
}
