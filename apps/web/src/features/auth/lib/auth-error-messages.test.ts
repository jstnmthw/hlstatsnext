import { describe, expect, it } from "vitest"
import { authErrorMessage } from "./auth-error-messages"

describe("authErrorMessage", () => {
  it("translates known codes", () => {
    expect(authErrorMessage("SESSION_NOT_FRESH", "x")).toMatch(/sign in again/)
    expect(authErrorMessage("STEAM_VERIFICATION_FAILED", "x")).toMatch(/Steam/)
  })

  it("falls back for unknown or missing codes", () => {
    expect(authErrorMessage("SOMETHING_ELSE", "fallback")).toBe("fallback")
    expect(authErrorMessage(null, "fallback")).toBe("fallback")
    expect(authErrorMessage(undefined, "fallback")).toBe("fallback")
  })
})
