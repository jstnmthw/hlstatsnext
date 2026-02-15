import { RegisterForm } from "@/features/auth/components/register-form"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Register - " + process.env.NEXT_PUBLIC_APP_NAME,
}

export default function RegisterPage() {
  const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  return <RegisterForm googleEnabled={googleEnabled} />
}
