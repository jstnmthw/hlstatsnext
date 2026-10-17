import { isAdmin } from "@repo/auth/permissions"
import { getSession } from "@repo/auth/session"
import { redirect } from "next/navigation"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  if (!session) {
    redirect("/login")
  }

  if (!isAdmin(session.user)) {
    redirect("/")
  }

  return <>{children}</>
}
