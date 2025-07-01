import type { AppError } from "@/shared/types"
import { GraphQLError } from "graphql"

/**
 * GraphQL error codes that map to HTTP status codes and provide client context
 * Internal enum - only used within this module
 */
enum GraphQLErrorCode {
  BAD_USER_INPUT = "BAD_USER_INPUT",
  NOT_FOUND = "NOT_FOUND",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  RATE_LIMITED = "RATE_LIMITED",
}

/**
 * Creates GraphQL errors from application errors following GraphQL Yoga patterns
 * Internal function - only used within this module
 */
function createGraphQLError(
  message: string,
  code: GraphQLErrorCode,
  details?: Record<string, unknown>,
): GraphQLError {
  return new GraphQLError(message, {
    extensions: {
      code,
      ...(details && { details }),
    },
  })
}

/**
 * Maps application errors to GraphQL errors with appropriate codes and user-friendly messages
 * This is the main export used by resolvers
 */
export function mapAppErrorToGraphQLError(error: AppError): GraphQLError {
  switch (error.type) {
    case "NOT_FOUND":
      return createGraphQLError(
        `The requested ${error.resource} was not found.`,
        GraphQLErrorCode.NOT_FOUND,
        {
          resource: error.resource,
          id: error.id,
        },
      )

    case "VALIDATION_ERROR":
      return createGraphQLError(
        `Invalid input for ${error.field}.`,
        GraphQLErrorCode.BAD_USER_INPUT,
        {
          field: error.field,
          value: error.value,
        },
      )

    case "UNAUTHORIZED":
      return createGraphQLError(
        "Authentication required to access this resource.",
        GraphQLErrorCode.UNAUTHORIZED,
      )

    case "DATABASE_ERROR":
      return createGraphQLError(
        "An internal error occurred. Please try again later.",
        GraphQLErrorCode.INTERNAL_SERVER_ERROR,
        {
          operation: error.operation,
        },
      )

    default:
      return createGraphQLError(
        "An internal error occurred. Please try again later.",
        GraphQLErrorCode.INTERNAL_SERVER_ERROR,
      )
  }
}
