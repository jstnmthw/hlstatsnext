"use server"

import { authErrorMessage } from "@/features/auth/lib/auth-error-messages"
import type { ActionResult } from "@/lib/actions"
import { forgetSteamId } from "@repo/auth/claims"
import { getAuth } from "@repo/auth/server"
import { requireAuth } from "@repo/auth/session"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

/** Unlink one of the caller's own accounts by its row id. */
export async function disconnectAccount(accountId: string): Promise<ActionResult> {
  const session = await requireAuth()
  const requestHeaders = await headers()

  const accounts = await getAuth().api.listUserAccounts({ headers: requestHeaders })
  const target = accounts.find((account) => account.id === accountId)
  if (!target) {
    return { ok: false, message: "That account is not connected." }
  }

  try {
    await getAuth().api.unlinkAccount({ body: { accountId }, headers: requestHeaders })
  } catch (error) {
    const code = (error as { body?: { code?: string } }).body?.code
    return { ok: false, message: authErrorMessage(code, "Could not disconnect the account.") }
  }

  if (target.providerId === "steam") {
    await forgetSteamId(session.user.id)
  }

  revalidatePath("/accounts/settings")
  return { ok: true, message: "Account disconnected." }
}
