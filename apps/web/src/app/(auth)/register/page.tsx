import { RegisterForm } from "@/features/auth/components/register-form"
import { getEnv } from "@repo/auth/env"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Register - " + process.env.NEXT_PUBLIC_APP_NAME,
}

export default function RegisterPage() {
  const googleEnabled = Boolean(getEnv().GOOGLE_CLIENT_ID)
  return <RegisterForm googleEnabled={googleEnabled} />
}
