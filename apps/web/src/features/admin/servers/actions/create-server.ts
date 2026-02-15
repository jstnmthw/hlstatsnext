"use server"

import { CREATE_SERVER_MUTATION } from "@/features/admin/servers/graphql/server-mutations"
import {
  createGraphQLFailureResult,
  createUnexpectedErrorResult,
  createValidationFailureResult,
  handleUniqueConstraintError,
  isRedirectError,
} from "@/features/admin/servers/utils/error-handlers"
import {
  extractFormDataForCreate,
  prepareCreateServerInput,
} from "@/features/admin/servers/utils/server-transformers"
import { getClient } from "@/lib/apollo-client"
import { logDevError } from "@/lib/dev-logger"
import {
  CreateServerSchema,
  type ServerOperationResult,
} from "@/lib/validators/schemas/server-schemas"
import { auth } from "@repo/auth"
import { getSession } from "@repo/auth/session"
import { redirect } from "next/navigation"
import { z } from "zod"

export type CreateServerFormData = z.infer<typeof CreateServerSchema>
export type CreateServerResult = ServerOperationResult

export async function createServer(
  _prevState: CreateServerResult,
  formData: FormData,
): Promise<CreateServerResult> {
  try {
    // Auth guard
    const session = await getSession()
    if (!session) {
      return { success: false, message: "Authentication required." }
    }

    const hasPermission = await auth.api.userHasPermission({
      body: { userId: session.user.id, permission: { server: ["create"] } },
    })
    if (!hasPermission.success) {
      return { success: false, message: "Insufficient permissions." }
    }

    // Extract and validate form data
    const rawData = extractFormDataForCreate(formData)
    const validation = CreateServerSchema.safeParse(rawData)

    if (!validation.success) {
      return createValidationFailureResult(validation.error.flatten().fieldErrors)
    }

    // Prepare GraphQL input
    const cleanedInput = prepareCreateServerInput(validation.data)

    // Execute GraphQL mutation
    const client = getClient()
    const result = await client.mutate({
      mutation: CREATE_SERVER_MUTATION,
      variables: {
        data: cleanedInput,
      },
    })

    if (!result.data?.createServerWithConfig) {
      console.error("GraphQL mutation failed")
      return createGraphQLFailureResult()
    }

    const { success, message, configsCount } = result.data.createServerWithConfig

    if (!success) {
      return {
        success: false,
        message: message || "Failed to create server. Please try again.",
      }
    }

    console.log(`Server created successfully with ${configsCount} configuration entries`)

    // Redirect to admin page on success
    redirect("/admin")
  } catch (error) {
    // Let Next.js redirect errors pass through
    if (isRedirectError(error)) {
      throw error
    }

    logDevError("Server creation error:", error)

    // Handle specific error types
    const uniqueConstraintError = handleUniqueConstraintError(error)
    if (uniqueConstraintError) {
      return uniqueConstraintError
    }

    return createUnexpectedErrorResult()
  }
}
