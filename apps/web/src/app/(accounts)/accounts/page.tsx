import { isAdmin } from "@repo/auth/permissions"
import { requireAuth } from "@repo/auth/session"
import { redirect } from "next/navigation"

// Where every sign-in method lands. The role is only known once the session
// exists, so OAuth and Steam callbacks and the email form all come here.
export default async function AccountsPage() {
  const session = await requireAuth()
  redirect(isAdmin(session.user) ? "/admin" : "/accounts/players")
}
