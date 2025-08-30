import type { Prisma } from "@repo/database/client"

/**
 * Type guard to check if an error is a Prisma known request error
 */
export function isPrismaClientKnownRequestError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  )
}

/**
 * Check if the error is a "record not found" error (P2025)
 */
export function isRecordNotFoundError(error: unknown): boolean {
  return isPrismaClientKnownRequestError(error) && error.code === "P2025"
}

/**
 * Get the Prisma error code if it's a known request error
 */
export function getPrismaErrorCode(error: unknown): string | undefined {
  return isPrismaClientKnownRequestError(error) ? error.code : undefined
}

/**
 * Handle Prisma errors and throw appropriate application errors
 */
export function handlePrismaError(
  error: unknown,
  defaultMessage = "Database operation failed",
): Error {
  if (isPrismaClientKnownRequestError(error)) {
    switch (error.code) {
      case "P2025":
        return new Error("Record not found")
      case "P2002":
        return new Error("Unique constraint violation")
      case "P2003":
        return new Error("Foreign key constraint violation")
      case "P2016":
        return new Error("Query interpretation error")
      default:
        return new Error(`Database error (${error.code}): ${error.message}`)
    }
  }

  if (error instanceof Error) {
    return error
  }

  return new Error(defaultMessage)
}
