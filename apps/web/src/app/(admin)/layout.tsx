import { requireAdmin } from "@repo/auth/session"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()

  return <>{children}</>
}
