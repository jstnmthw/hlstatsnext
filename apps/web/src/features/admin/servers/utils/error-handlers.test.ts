import { afterEach, describe, expect, it, vi } from "vitest"
import {
  createUnexpectedErrorResult,
  createValidationFailureResult,
  handleUniqueConstraintError,
  logGraphQLErrors,
} from "./error-handlers"

describe("handleUniqueConstraintError", () => {
  it("returns result for unique constraint on address/port", () => {
    const error = new Error("Unique constraint failed on the fields: (`servers_address_port_key`)")
    const result = handleUniqueConstraintError(error)
    expect(result).not.toBeNull()
    expect(result!.ok).toBe(false)
    expect(result!.message).toContain("already exists")
    expect(result!.errors?.address).toBeDefined()
    expect(result!.errors?.port).toBeDefined()
  })

  it("returns result for addressport variant", () => {
    const error = new Error("Unique constraint failed on: addressport")
    const result = handleUniqueConstraintError(error)
    expect(result).not.toBeNull()
    expect(result!.ok).toBe(false)
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
      ok: false,
      message: "Validation failed",
      errors,
    })
  })
})

describe("createUnexpectedErrorResult", () => {
  it("returns an unexpected error result", () => {
    const result = createUnexpectedErrorResult()
    expect(result.ok).toBe(false)
    expect(result.message).toContain("unexpected error")
  })
})
