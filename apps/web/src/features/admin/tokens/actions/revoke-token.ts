"use server"

import type { ActionResult } from "@/lib/actions"
import { revokeServerToken } from "@/lib/data/tokens"
import { requireAdmin } from "@repo/auth/session"
import { revalidatePath } from "next/cache"

export async function revokeToken(tokenId: number): Promise<ActionResult> {
  await requireAdmin()

  try {
    const result = await revokeServerToken(tokenId)
    if (!result.ok) {
      return { ok: false, message: result.message ?? "Failed to revoke token." }
    }

    revalidatePath("/admin/tokens")
    return { ok: true, message: result.message ?? "Token revoked successfully." }
  } catch (error) {
    console.error("Token revocation error:", error)
    return { ok: false, message: "An unexpected error occurred. Please try again." }
  }
}
