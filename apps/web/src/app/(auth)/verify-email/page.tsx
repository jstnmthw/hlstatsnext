import { redirect } from "next/navigation"
import { VerifyEmailForm } from "@/features/auth/components/verify-email-form"

interface VerifyEmailPageProps {
  searchParams: Promise<{ email?: string }>
}

export const metadata = {
  title: "Verify Email - " + process.env.NEXT_PUBLIC_APP_NAME,
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { email } = await searchParams

  if (!email) {
    redirect("/register")
  }

  return <VerifyEmailForm email={email} />
}
