import { AppLogo } from "@/features/common/components/app-logo"
import { isAdmin } from "@repo/auth/permissions"
import { getSession } from "@repo/auth/session"
import { redirect } from "next/navigation"

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  // Presence, not emailVerified: a Steam account has a synthetic, unverified
  // address and must still be sent away from the sign-in pages. An email
  // sign-up has no session until it is verified, so it still reaches /verify-email.
  if (session) {
    redirect(isAdmin(session.user) ? "/admin" : "/")
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
