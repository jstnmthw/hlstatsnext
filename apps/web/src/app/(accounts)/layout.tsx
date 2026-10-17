import { requireAuth } from "@repo/auth/session"

export default async function AccountsLayout({ children }: { children: React.ReactNode }) {
  await requireAuth()

  return <>{children}</>
}
