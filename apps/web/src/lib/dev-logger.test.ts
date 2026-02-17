import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { formatDevError, logDevError, logDevInfo } from "./dev-logger"

describe("logDevError", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
    vi.unstubAllEnvs()
  })

  it("logs with inspect in development mode", () => {
    vi.stubEnv("NODE_ENV", "development")

    logDevError("test message", { key: "value" })
    expect(consoleSpy).toHaveBeenCalledWith("test message")
    expect(consoleSpy).toHaveBeenCalledWith("[0]:", expect.any(String))
  })

  it("logs primitives directly in development mode", () => {
    vi.stubEnv("NODE_ENV", "development")

    logDevError("test message", "plain string", 42)
    expect(consoleSpy).toHaveBeenCalledWith("[0]:", "plain string")
    expect(consoleSpy).toHaveBeenCalledWith("[1]:", 42)
  })

  it("uses standard console.error in production", () => {
    vi.stubEnv("NODE_ENV", "production")

    logDevError("test message", { key: "value" })
    expect(consoleSpy).toHaveBeenCalledWith("test message", { key: "value" })
  })

  it("handles Apollo errors with networkError.result.errors", () => {
    vi.stubEnv("NODE_ENV", "development")

    const apolloError = {
      networkError: {
        result: {
          errors: [{ message: "GraphQL error" }],
        },
      },
    }

    logDevError("Apollo error:", apolloError)
    expect(consoleSpy.mock.calls.length).toBeGreaterThan(2)
  })
})

describe("logDevInfo", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
    vi.unstubAllEnvs()
  })

  it("logs with inspect in development mode", () => {
    vi.stubEnv("NODE_ENV", "development")

    logDevInfo("test info", { data: [1, 2] })
    expect(consoleSpy).toHaveBeenCalledWith("test info")
    expect(consoleSpy).toHaveBeenCalledWith("[0]:", expect.any(String))
  })

  it("logs primitives directly in development mode", () => {
    vi.stubEnv("NODE_ENV", "development")

    logDevInfo("message", "text")
    expect(consoleSpy).toHaveBeenCalledWith("[0]:", "text")
  })

  it("uses standard console.log in production", () => {
    vi.stubEnv("NODE_ENV", "production")

    logDevInfo("test info", { data: [1, 2] })
    expect(consoleSpy).toHaveBeenCalledWith("test info", { data: [1, 2] })
  })
})

describe("formatDevError", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns inspect output in development mode", () => {
    vi.stubEnv("NODE_ENV", "development")

    const result = formatDevError({ key: "value" })
    expect(result).toContain("key")
    expect(result).toContain("value")
  })

  it("returns String() in production mode", () => {
    vi.stubEnv("NODE_ENV", "production")

    const result = formatDevError(new Error("test"))
    expect(result).toBe("Error: test")
  })

  it("handles primitive values in production", () => {
    vi.stubEnv("NODE_ENV", "production")

    expect(formatDevError("error string")).toBe("error string")
    expect(formatDevError(42)).toBe("42")
  })
})
