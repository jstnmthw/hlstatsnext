import { getSession } from "@repo/auth/session"
import { redirect } from "next/navigation"
import { AppLogo } from "@/features/common/components/app-logo"

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
      <div className="mb-8">
        <AppLogo />
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
