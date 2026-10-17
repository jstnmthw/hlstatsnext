/**
 * Error handling utilities for server operations
 *
 * Provides specialized error handling functions to reduce complexity
 * in the main server action functions and improve maintainability.
 */

import type { ActionResult } from "@/lib/actions"
import { logDevError } from "@/lib/dev-logger"

/**
 * Handles Prisma unique constraint violations
 * @param error - The error to handle
 * @returns ActionResult if it's a unique constraint error, null otherwise
 */
export function handleUniqueConstraintError(error: unknown): ActionResult | null {
  if (!(error && typeof error === "object" && "message" in error)) {
    return null
  }

  const errorMessage = (error as Error).message
  const isUniqueConstraintError =
    errorMessage.includes("Unique constraint failed") &&
    (errorMessage.includes("servers_address_port_key") || errorMessage.includes("addressport"))

  if (!isUniqueConstraintError) {
    return null
  }

  return {
    ok: false,
    message: "A server with this address and port already exists.",
    errors: {
      address: ["This server address and port combination is already in use"],
      port: ["This server address and port combination is already in use"],
    },
  }
}

/**
 * Logs GraphQL network errors with proper formatting
 * @param error - The error that might contain GraphQL network errors
 */
export function logGraphQLErrors(error: unknown): void {
  if (!(error && typeof error === "object" && "networkError" in error)) {
    return
  }

  const apolloError = error as { networkError?: { result?: { errors?: unknown[] } } }
  if (apolloError.networkError?.result?.errors) {
    if (process.env.NODE_ENV === "development") {
      // In development, show full error details with proper array content
      logDevError("GraphQL network errors:", apolloError.networkError.result.errors)

      // Also log the entire error object for full context
      logDevError("Full Apollo error object:", apolloError)
    } else {
      // In production, use the existing JSON.stringify approach
      console.error(
        "GraphQL errors:",
        JSON.stringify(apolloError.networkError.result.errors, null, 2),
      )
    }
  }
}

/**
 * Creates a generic validation failure result
 * @param errors - The validation errors from Zod
 * @returns Formatted ActionResult
 */
export function createValidationFailureResult(errors: Record<string, string[]>): ActionResult {
  return {
    ok: false,
    message: "Validation failed",
    errors,
  }
}

/**
 * Creates a generic unexpected error result
 * @returns ActionResult for unexpected errors
 */
export function createUnexpectedErrorResult(): ActionResult {
  return {
    ok: false,
    message: "An unexpected error occurred. Please try again.",
  }
}
