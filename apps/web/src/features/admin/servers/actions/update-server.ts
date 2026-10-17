"use server"

import {
  createUnexpectedErrorResult,
  createValidationFailureResult,
  handleUniqueConstraintError,
  logGraphQLErrors,
} from "@/features/admin/servers/utils/error-handlers"
import { extractFormDataForUpdate } from "@/features/admin/servers/utils/server-transformers"
import type { ActionResult } from "@/lib/actions"
import { updateServer as updateServerRecord } from "@/lib/data/servers"
import { logDevError } from "@/lib/dev-logger"
import { UpdateServerSchema } from "@/lib/validators/schemas/server-schemas"
import { requirePermission } from "@repo/auth/session"
import { redirect } from "next/navigation"
import { z } from "zod"

export type UpdateServerFormData = z.infer<typeof UpdateServerSchema>
export type UpdateServerResult = ActionResult

export async function updateServer(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requirePermission({ server: ["update"] })

  const validation = UpdateServerSchema.safeParse(extractFormDataForUpdate(formData))
  if (!validation.success) {
    return createValidationFailureResult(validation.error.flatten().fieldErrors)
  }

  const serverInput = {
    name: validation.data.name || undefined,
    address: validation.data.address || undefined,
    port: validation.data.port,
    game: validation.data.game,
    mod: validation.data.mod || undefined,
    publicAddress: validation.data.publicAddress || undefined,
    rconAddress: validation.data.rconAddress || undefined,
    statusUrl: validation.data.statusUrl || undefined,
    rconPassword: validation.data.rconPassword || undefined,
    sortOrder: validation.data.sortOrder,
  }

  try {
    const result = await updateServerRecord(validation.data.serverId, serverInput)
    if (!result.ok) {
      return { ok: false, message: result.message ?? "Failed to update server. Please try again." }
    }
  } catch (error) {
    logDevError("Server update error:", error)
    logGraphQLErrors(error)
    return handleUniqueConstraintError(error) ?? createUnexpectedErrorResult()
  }

  redirect("/admin/servers")
}
