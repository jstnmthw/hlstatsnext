"use server"

import type { ActionResult } from "@/lib/actions"
import { updateMyPlayer } from "@/lib/data/my-players"
import type { MyPlayerPreferences } from "@/lib/my-players"
import { requirePermission } from "@repo/auth/session"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const PreferencesSchema = z.object({
  hideRanking: z.boolean().optional(),
  displayEvents: z.boolean().optional(),
  blockAvatar: z.boolean().optional(),
})

export async function updateMyPlayerPreferences(
  playerId: number,
  preferences: MyPlayerPreferences,
): Promise<ActionResult> {
  await requirePermission({ player: ["update-own"] })

  const validation = PreferencesSchema.safeParse(preferences)
  if (!validation.success || !Number.isInteger(playerId)) {
    return { ok: false, message: "Those settings are not valid." }
  }

  try {
    const result = await updateMyPlayer(playerId, validation.data)
    if (!result.ok) {
      return { ok: false, message: "Could not save the change." }
    }
    revalidatePath("/accounts/players")
    return { ok: true, message: "Saved." }
  } catch (error) {
    console.error("updateMyPlayerPreferences error:", error)
    return { ok: false, message: "Could not save the change." }
  }
}
