import { LoginScreen } from "@/components/login-screen"
import { DEVELOPMENT_PREVIEW_EMAIL, DEVELOPMENT_PREVIEW_PASSWORD, loginConfigurationFromEnvironment } from "@/lib/auth"

export default function LoginPage() {
  const previewCredentials = loginConfigurationFromEnvironment()?.isDevelopmentPreview
    ? { email: DEVELOPMENT_PREVIEW_EMAIL, password: DEVELOPMENT_PREVIEW_PASSWORD }
    : undefined

  return <LoginScreen previewCredentials={previewCredentials} />
}
