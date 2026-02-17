import { getSession } from "@repo/auth/session"
import { redirect } from "next/navigation"

export default async function AccountsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  if (!session) {
    redirect("/login")
  }

  return <>{children}</>
}
