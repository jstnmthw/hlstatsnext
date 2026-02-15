import { AppLogo } from "@/features/common/components/app-logo"
import { getSession } from "@repo/auth/session"
import { redirect } from "next/navigation"

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  // Only redirect verified users — unverified users need access to /verify-email
  if (session?.user.emailVerified) {
    if (session.user.role === "admin") {
      redirect("/admin")
    }
    redirect("/")
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-8">
        <AppLogo />
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}
