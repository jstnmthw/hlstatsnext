"use server"

import type { DocumentNode } from "graphql"
import { redirect } from "next/navigation"
import { getClient } from "@/lib/apollo-client"
import { UPDATE_SERVER_MUTATION } from "@/features/admin/servers/graphql/server-mutations"
import {
  UpdateServerSchema,
  type UpdateServerFormData,
  type ServerOperationResult,
} from "@/lib/validators/schemas/server-schemas"
import {
  extractFormDataForUpdate,
  prepareUpdateServerInput,
} from "@/features/admin/servers/utils/server-transformers"
import {
  isRedirectError,
  handleUniqueConstraintError,
  logGraphQLErrors,
  createValidationFailureResult,
  createGraphQLFailureResult,
  createUnexpectedErrorResult,
} from "@/features/admin/servers/utils/error-handlers"

export type { UpdateServerFormData }
export type UpdateServerResult = ServerOperationResult

export async function updateServer(
  _prevState: UpdateServerResult,
  formData: FormData,
): Promise<UpdateServerResult> {
  try {
    // Extract and validate form data
    const rawData = extractFormDataForUpdate(formData)
    const validation = UpdateServerSchema.safeParse(rawData)

    if (!validation.success) {
      return createValidationFailureResult(validation.error.flatten().fieldErrors)
    }

    // Prepare Prisma field update operations input
    const serverInput = prepareUpdateServerInput(validation.data)

    // Debug logging
    console.log("Update server input:", JSON.stringify(serverInput, null, 2))

    // Execute GraphQL mutation
    const client = getClient()
    const result = await client.mutate({
      mutation: UPDATE_SERVER_MUTATION as DocumentNode,
      variables: {
        where: {
          serverId: validation.data.serverId,
        },
        data: serverInput,
      },
    })

    if (!result.data?.updateOneServer) {
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

    console.error("Server update error:", error)

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
