import { afterEach, describe, expect, it, vi } from "vitest"
import {
  createGraphQLFailureResult,
  createUnexpectedErrorResult,
  createValidationFailureResult,
  handleUniqueConstraintError,
  isRedirectError,
  logGraphQLErrors,
} from "./error-handlers"

describe("isRedirectError", () => {
  it("returns true for NEXT_REDIRECT errors", () => {
    const error = new Error("NEXT_REDIRECT")
    expect(isRedirectError(error)).toBe(true)
  })

  it("returns false for other errors", () => {
    expect(isRedirectError(new Error("Something else"))).toBe(false)
    expect(isRedirectError(null)).toBe(false)
    expect(isRedirectError(undefined)).toBe(false)
    expect(isRedirectError("string")).toBe(false)
    expect(isRedirectError(42)).toBe(false)
  })
})

describe("handleUniqueConstraintError", () => {
  it("returns result for unique constraint on address/port", () => {
    const error = new Error("Unique constraint failed on the fields: (`servers_address_port_key`)")
    const result = handleUniqueConstraintError(error)
    expect(result).not.toBeNull()
    expect(result!.success).toBe(false)
    expect(result!.message).toContain("already exists")
    expect(result!.errors?.address).toBeDefined()
    expect(result!.errors?.port).toBeDefined()
  })

  it("returns result for addressport variant", () => {
    const error = new Error("Unique constraint failed on: addressport")
    const result = handleUniqueConstraintError(error)
    expect(result).not.toBeNull()
    expect(result!.success).toBe(false)
  })

  it("returns null for non-unique-constraint errors", () => {
    expect(handleUniqueConstraintError(new Error("Some other error"))).toBeNull()
    expect(
      handleUniqueConstraintError(new Error("Unique constraint failed on name_key")),
    ).toBeNull()
  })

  it("returns null for non-error objects", () => {
    expect(handleUniqueConstraintError(null)).toBeNull()
    expect(handleUniqueConstraintError(undefined)).toBeNull()
    expect(handleUniqueConstraintError(42)).toBeNull()
    expect(handleUniqueConstraintError("string")).toBeNull()
  })
})

describe("logGraphQLErrors", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("logs errors in development mode", () => {
    vi.stubEnv("NODE_ENV", "development")
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const error = {
      networkError: {
        result: {
          errors: [{ message: "GraphQL error" }],
        },
      },
    }

    logGraphQLErrors(error)
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it("logs errors in production mode with JSON", () => {
    vi.stubEnv("NODE_ENV", "production")
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const error = {
      networkError: {
        result: {
          errors: [{ message: "GraphQL error" }],
        },
      },
    }

    logGraphQLErrors(error)
    expect(consoleSpy).toHaveBeenCalledWith("GraphQL errors:", expect.any(String))

    consoleSpy.mockRestore()
  })

  it("does nothing for non-network errors", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    logGraphQLErrors(new Error("normal error"))
    logGraphQLErrors(null)
    logGraphQLErrors({ networkError: null })
    expect(consoleSpy).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})

describe("createValidationFailureResult", () => {
  it("returns a validation failure result", () => {
    const errors = { name: ["Name is required"], port: ["Port is invalid"] }
    const result = createValidationFailureResult(errors)
    expect(result).toEqual({
      success: false,
      message: "Validation failed",
      errors,
    })
  })
})

describe("createGraphQLFailureResult", () => {
  it("returns a GraphQL failure result", () => {
    const result = createGraphQLFailureResult()
    expect(result.success).toBe(false)
    expect(result.message).toContain("Please try again")
  })
})

describe("createUnexpectedErrorResult", () => {
  it("returns an unexpected error result", () => {
    const result = createUnexpectedErrorResult()
    expect(result.success).toBe(false)
    expect(result.message).toContain("unexpected error")
  })
})
