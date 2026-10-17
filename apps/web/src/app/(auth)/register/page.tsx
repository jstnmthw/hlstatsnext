import { RegisterForm } from "@/features/auth/components/register-form"
import { getEnv } from "@repo/auth/env"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Register - " + process.env.NEXT_PUBLIC_APP_NAME,
}

interface PageProps {
  // Steam and OAuth callbacks come back here with ?error=CODE when they fail.
  searchParams: Promise<{ error?: string }>
}

export default async function RegisterPage({ searchParams }: PageProps) {
  const { error } = await searchParams
  const googleEnabled = Boolean(getEnv().GOOGLE_CLIENT_ID)
  return <RegisterForm googleEnabled={googleEnabled} errorCode={error} />
}
