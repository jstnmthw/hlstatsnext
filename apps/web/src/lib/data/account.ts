import "server-only"

import type { AccountOverview, LinkedAccount } from "@/lib/account"
import { getAuth } from "@repo/auth/server"
import { requireAuth } from "@repo/auth/session"
import { headers } from "next/headers"

export async function accountOverview(): Promise<AccountOverview> {
  const session = await requireAuth()
  const accounts = await getAuth().api.listUserAccounts({ headers: await headers() })

  const linked = (providerId: string): LinkedAccount | null => {
    const account = accounts.find((candidate) => candidate.providerId === providerId)
    return account ? { id: account.id, providerId, accountId: account.accountId } : null
  }

  return {
    email: session.user.email,
    emailVerified: session.user.emailVerified,
    hasPassword: linked("credential") !== null,
    steam: linked("steam"),
    google: linked("google"),
    signInMethods: accounts.length,
  }
}
