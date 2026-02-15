import { getSession } from "@repo/auth/session"
import { redirect } from "next/navigation"
import { AppLogo } from "@/features/common/components/app-logo"

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  // Redirect already-authenticated admin users to admin dashboard
  if (session?.user.role === "admin") {
    redirect("/admin")
  }

  // Redirect authenticated non-admin users to homepage
  if (session) {
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
