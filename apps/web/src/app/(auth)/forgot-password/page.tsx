import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form"

export const metadata = {
  title: "Forgot Password - " + process.env.NEXT_PUBLIC_APP_NAME,
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />
}
