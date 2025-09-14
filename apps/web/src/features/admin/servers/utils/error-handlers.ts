/**
 * Error handling utilities for server operations
 *
 * Provides specialized error handling functions to reduce complexity
 * in the main server action functions and improve maintainability.
 */

import type { ServerOperationResult } from "@/lib/validators/schemas/server-schemas"
import { logDevError } from "@/lib/dev-logger"

/**
 * Checks if an error is a Next.js redirect error that should be re-thrown
 * @param error - The error to check
 * @returns true if it's a redirect error, false otherwise
 */
export function isRedirectError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "message" in error &&
      (error as Error).message === "NEXT_REDIRECT",
  )
}

/**
 * Handles Prisma unique constraint violations
 * @param error - The error to handle
 * @returns ServerOperationResult if it's a unique constraint error, null otherwise
 */
export function handleUniqueConstraintError(error: unknown): ServerOperationResult | null {
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
    success: false,
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
 * @returns Formatted ServerOperationResult
 */
export function createValidationFailureResult(
  errors: Record<string, string[]>,
): ServerOperationResult {
  return {
    success: false,
    message: "Validation failed",
    errors,
  }
}

/**
 * Creates a generic GraphQL failure result
 * @returns ServerOperationResult for GraphQL failures
 */
export function createGraphQLFailureResult(): ServerOperationResult {
  return {
    success: false,
    message: "Failed to execute operation. Please try again.",
  }
}

/**
 * Creates a generic unexpected error result
 * @returns ServerOperationResult for unexpected errors
 */
export function createUnexpectedErrorResult(): ServerOperationResult {
  return {
    success: false,
    message: "An unexpected error occurred. Please try again.",
  }
}
