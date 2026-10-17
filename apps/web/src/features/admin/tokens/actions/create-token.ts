"use server"

import type { ActionResult } from "@/lib/actions"
import { createServerToken } from "@/lib/data/tokens"
import { requireAdmin } from "@repo/auth/session"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const CreateTokenSchema = z.object({
  name: z.string().min(1, "Name is required").max(128, "Name is too long"),
  game: z.string().min(1, "Game type is required"),
  rconPassword: z.string().max(255, "RCON password is too long").optional(),
  expiresAt: z.string().optional(),
})

export interface TokenCreated {
  rawToken: string
}

export async function createToken(
  _prevState: ActionResult<TokenCreated>,
  formData: FormData,
): Promise<ActionResult<TokenCreated>> {
  await requireAdmin()

  const validation = CreateTokenSchema.safeParse({
    name: formData.get("name") as string,
    game: formData.get("game") as string,
    rconPassword: formData.get("rconPassword") as string,
    expiresAt: formData.get("expiresAt") as string,
  })
  if (!validation.success) {
    return {
      ok: false,
      message: "Validation failed",
      errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  try {
    const result = await createServerToken(validation.data)
    if (!result.ok || !result.rawToken) {
      return { ok: false, message: result.message ?? "Failed to create token." }
    }

    revalidatePath("/admin/tokens")
    return {
      ok: true,
      message: result.message ?? "Token created successfully.",
      data: { rawToken: result.rawToken },
    }
  } catch (error) {
    console.error("Token creation error:", error)
    return { ok: false, message: "An unexpected error occurred. Please try again." }
  }
}
