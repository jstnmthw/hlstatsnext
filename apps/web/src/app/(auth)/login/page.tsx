import { LoginForm } from "@/features/auth/components/login-form"
import { getEnv } from "@repo/auth/env"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sign In - " + process.env.NEXT_PUBLIC_APP_NAME,
}

export default function LoginPage() {
  const googleEnabled = Boolean(getEnv().GOOGLE_CLIENT_ID)
  return <LoginForm googleEnabled={googleEnabled} />
}
