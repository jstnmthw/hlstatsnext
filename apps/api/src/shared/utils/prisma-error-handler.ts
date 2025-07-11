import type { Prisma } from "@repo/database"

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
