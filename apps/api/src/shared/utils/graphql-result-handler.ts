import type { Result, AppError } from "../types/common"
import { mapAppErrorToGraphQLError } from "../types/common"

/**
 * Handles Result types in GraphQL resolvers by throwing appropriate errors for failures
 * or returning the data for successes
 */
export function handleGraphQLResult<T>(result: Result<T, AppError>): T {
  if (!result.success) {
    throw mapAppErrorToGraphQLError(result.error)
  }

  return result.data
}

/**
 * Handles nullable Result types in GraphQL resolvers
 * Returns null for failures instead of throwing errors
 */
export function handleGraphQLResultNullable<T>(result: Result<T, AppError>): T | null {
  if (!result.success) {
    // Log the error but return null instead of throwing
    console.warn(`GraphQL nullable result failed:`, {
      error: result.error,
      timestamp: new Date().toISOString(),
    })
    return null
  }

  return result.data
}

/**
 * Async version of handleGraphQLResult for promise-based operations
 */
export async function handleGraphQLResultAsync<T>(resultPromise: Promise<Result<T, AppError>>): Promise<T> {
  const result = await resultPromise
  return handleGraphQLResult(result)
}

/**
 * Async version of handleGraphQLResultNullable for promise-based operations
 */
export async function handleGraphQLResultNullableAsync<T>(
  resultPromise: Promise<Result<T, AppError>>,
): Promise<T | null> {
  const result = await resultPromise
  return handleGraphQLResultNullable(result)
}
