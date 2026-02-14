import type { Metadata } from "next"
import { LoginForm } from "@/features/auth/components/login-form"

export const metadata: Metadata = {
  title: "Sign In - " + process.env.NEXT_PUBLIC_APP_NAME,
}

export default function LoginPage() {
  const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  return <LoginForm googleEnabled={googleEnabled} />
}
