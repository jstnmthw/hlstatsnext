/**
 * Development Logger Utility
 *
 * Provides enhanced logging capabilities for development mode that properly
 * displays complex objects, arrays, and nested structures instead of showing
 * [Array] or [Object] placeholders.
 */

import { inspect } from "util"

/**
 * Enhanced console.error that shows full object depth in development mode
 * @param message - The error message
 * @param data - The data to log (can be error objects, arrays, etc.)
 */
export function logDevError(message: string, ...data: unknown[]): void {
  if (process.env.NODE_ENV === "development") {
    console.error(message)

    // Log each piece of data with full inspection
    data.forEach((item, index) => {
      if (item && typeof item === "object") {
        // First try util.inspect with aggressive settings
        console.error(
          `[${index}]:`,
          inspect(item, {
            depth: null,
            colors: true,
            showHidden: false,
            maxArrayLength: null,
            maxStringLength: null,
            breakLength: 80,
            compact: false,
            getters: false,
            showProxy: false,
          }),
        )

        // Additionally, for Apollo errors, specifically extract and log the errors array
        if (isApolloError(item)) {
          logApolloErrorDetails(item as ApolloErrorType, index)
        }
      } else {
        console.error(`[${index}]:`, item)
      }
    })
  } else {
    // In production, use standard console.error to avoid verbose output
    console.error(message, ...data)
  }
}

/**
 * Type guard to check if an error is an Apollo error
 */
function isApolloError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "networkError" in error &&
    error.networkError &&
    typeof error.networkError === "object" &&
    "result" in error.networkError,
  )
}

/**
 * Apollo error type for better type safety
 */
type ApolloErrorType = {
  networkError: {
    result?: {
      errors?: unknown[]
    }
  }
}

/**
 * Specifically logs Apollo error details to reveal the hidden array content
 */
function logApolloErrorDetails(error: ApolloErrorType, index: number): void {
  if (error.networkError?.result?.errors) {
    console.error(`[${index}] Apollo Error Details - GraphQL Errors:`)

    // Log each error in the array individually
    error.networkError.result.errors.forEach((graphqlError, errorIndex) => {
      console.error(
        `  Error ${errorIndex}:`,
        inspect(graphqlError, {
          depth: null,
          colors: true,
          compact: false,
          maxArrayLength: null,
          maxStringLength: null,
        }),
      )
    })

    // Also try JSON.stringify as a fallback
    console.error(`[${index}] Apollo Error Details - JSON:`)
    try {
      console.error(JSON.stringify(error.networkError.result.errors, null, 2))
    } catch (jsonError) {
      console.error("Could not stringify GraphQL errors:", jsonError)
    }
  }
}

/**
 * Enhanced console.log that shows full object depth in development mode
 * @param message - The log message
 * @param data - The data to log (can be objects, arrays, etc.)
 */
export function logDevInfo(message: string, ...data: unknown[]): void {
  if (process.env.NODE_ENV === "development") {
    console.log(message)

    // Log each piece of data with full inspection
    data.forEach((item, index) => {
      if (item && typeof item === "object") {
        console.log(
          `[${index}]:`,
          inspect(item, {
            depth: null,
            colors: true,
            showHidden: false,
            maxArrayLength: null,
            maxStringLength: null,
            breakLength: 80,
            compact: false,
          }),
        )
      } else {
        console.log(`[${index}]:`, item)
      }
    })
  } else {
    // In production, use standard console.log
    console.log(message, ...data)
  }
}

/**
 * Formats an error object for development logging, showing all properties
 * including nested arrays and objects
 * @param error - The error to format
 * @returns Formatted error string
 */
export function formatDevError(error: unknown): string {
  if (process.env.NODE_ENV === "development") {
    return inspect(error, {
      depth: null,
      colors: false,
      showHidden: false,
      maxArrayLength: null,
      maxStringLength: null,
      breakLength: 120,
      compact: false,
    })
  }

  // In production, return basic string representation
  return String(error)
}
