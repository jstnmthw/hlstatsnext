import { getSession } from "@repo/auth/session"
import { redirect } from "next/navigation"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  if (!session) {
    redirect("/login")
  }

  if (session.user.role !== "admin") {
    redirect("/")
  }

  return <>{children}</>
}
