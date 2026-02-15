"use server"

import { UPDATE_SERVER_WITH_CONFIG_MUTATION } from "@/features/admin/servers/graphql/server-mutations"
import {
  createGraphQLFailureResult,
  createUnexpectedErrorResult,
  createValidationFailureResult,
  handleUniqueConstraintError,
  isRedirectError,
  logGraphQLErrors,
} from "@/features/admin/servers/utils/error-handlers"
import { extractFormDataForUpdate } from "@/features/admin/servers/utils/server-transformers"
import { getClient } from "@/lib/apollo-client"
import { logDevError } from "@/lib/dev-logger"
import {
  UpdateServerSchema,
  type ServerOperationResult,
} from "@/lib/validators/schemas/server-schemas"
import { auth } from "@repo/auth"
import { getSession } from "@repo/auth/session"
import { redirect } from "next/navigation"
import { z } from "zod"

export type UpdateServerFormData = z.infer<typeof UpdateServerSchema>
export type UpdateServerResult = ServerOperationResult

export async function updateServer(
  _prevState: UpdateServerResult,
  formData: FormData,
): Promise<UpdateServerResult> {
  try {
    // Auth guard
    const session = await getSession()
    if (!session) {
      return { success: false, message: "Authentication required." }
    }

    const hasPermission = await auth.api.userHasPermission({
      body: { userId: session.user.id, permission: { server: ["update"] } },
    })
    if (!hasPermission.success) {
      return { success: false, message: "Insufficient permissions." }
    }

    // Extract and validate form data
    const rawData = extractFormDataForUpdate(formData)
    const validation = UpdateServerSchema.safeParse(rawData)

    if (!validation.success) {
      return createValidationFailureResult(validation.error.flatten().fieldErrors)
    }

    // Prepare GraphQL input for server update with config
    const serverInput = {
      name: validation.data.name || undefined,
      ...(validation.data.connection_type === "docker"
        ? { dockerHost: validation.data.docker_host }
        : { address: validation.data.address }),
      port: validation.data.port,
      game: validation.data.game,
      mod: validation.data.mod || undefined,
      publicAddress: validation.data.publicAddress || undefined,
      statusUrl: validation.data.statusUrl || undefined,
      rconPassword: validation.data.rconPassword || undefined,
      connectionType: validation.data.connection_type,
      sortOrder: validation.data.sortOrder,
    }

    // Execute GraphQL mutation
    const client = getClient()
    const result = await client.mutate({
      mutation: UPDATE_SERVER_WITH_CONFIG_MUTATION,
      variables: {
        serverId: validation.data.serverId,
        data: serverInput,
      },
    })

    if (!result.data?.updateServerWithConfig) {
      console.error("GraphQL mutation failed")
      return createGraphQLFailureResult()
    }

    // Redirect to admin servers page on success
    redirect("/admin/servers")
  } catch (error) {
    // Let Next.js redirect errors pass through
    if (isRedirectError(error)) {
      throw error
    }

    logDevError("Server update error:", error)

    // Log GraphQL errors with proper formatting
    logGraphQLErrors(error)

    // Handle specific error types
    const uniqueConstraintError = handleUniqueConstraintError(error)
    if (uniqueConstraintError) {
      return uniqueConstraintError
    }

    return createUnexpectedErrorResult()
  }
}
