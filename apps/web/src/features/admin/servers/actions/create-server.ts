"use server"

import {
  createUnexpectedErrorResult,
  createValidationFailureResult,
  handleUniqueConstraintError,
} from "@/features/admin/servers/utils/error-handlers"
import {
  extractFormDataForCreate,
  prepareCreateServerInput,
} from "@/features/admin/servers/utils/server-transformers"
import type { ActionResult } from "@/lib/actions"
import { createServer as createServerRecord } from "@/lib/data/servers"
import { logDevError } from "@/lib/dev-logger"
import { CreateServerSchema } from "@/lib/validators/schemas/server-schemas"
import { requirePermission } from "@repo/auth/session"
import { redirect } from "next/navigation"
import { z } from "zod"

export type CreateServerFormData = z.infer<typeof CreateServerSchema>
export type CreateServerResult = ActionResult

export async function createServer(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requirePermission({ server: ["create"] })

  const validation = CreateServerSchema.safeParse(extractFormDataForCreate(formData))
  if (!validation.success) {
    return createValidationFailureResult(validation.error.flatten().fieldErrors)
  }

  try {
    const result = await createServerRecord(prepareCreateServerInput(validation.data))
    if (!result.ok) {
      return { ok: false, message: result.message ?? "Failed to create server. Please try again." }
    }
  } catch (error) {
    logDevError("Server creation error:", error)
    return handleUniqueConstraintError(error) ?? createUnexpectedErrorResult()
  }

  redirect("/admin")
}
