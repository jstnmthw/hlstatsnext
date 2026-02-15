import { redirect } from "next/navigation"
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form"

interface ResetPasswordPageProps {
  searchParams: Promise<{ email?: string }>
}

export const metadata = {
  title: "Reset Password - " + process.env.NEXT_PUBLIC_APP_NAME,
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { email } = await searchParams

  if (!email) {
    redirect("/forgot-password")
  }

  return <ResetPasswordForm email={email} />
}
