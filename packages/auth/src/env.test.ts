import { describe, expect, it } from "vitest"
import { parseAuthEnv } from "./env"

const minimal = {
  BETTER_AUTH_SECRET: "s".repeat(44),
  BETTER_AUTH_URL: "http://localhost:3000",
}

describe("parseAuthEnv", () => {
  it("accepts the minimum set and applies defaults", () => {
    const env = parseAuthEnv(minimal)
    expect(env.BETTER_AUTH_URL).toBe("http://localhost:3000")
    expect(env.MAIL_PROVIDER).toBe("console")
    expect(env.MAIL_FROM).toBe("noreply@hlstatsnext.com")
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined()
    expect(env.RESEND_API_KEY).toBeUndefined()
  })

  it("ignores variables outside the schema", () => {
    const env = parseAuthEnv({ ...minimal, DATABASE_URL: "mysql://x" })
    expect(env).not.toHaveProperty("DATABASE_URL")
  })

  it("names every missing or invalid variable in one error", () => {
    expect(() => parseAuthEnv({})).toThrow(/BETTER_AUTH_SECRET[\s\S]*BETTER_AUTH_URL/)
    expect(() => parseAuthEnv({ BETTER_AUTH_SECRET: "short", BETTER_AUTH_URL: "nope" })).toThrow(
      /BETTER_AUTH_SECRET must be at least 32[\s\S]*BETTER_AUTH_URL must be an absolute URL/,
    )
  })

  it("treats blank values as unset", () => {
    const env = parseAuthEnv({ ...minimal, GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "   " })
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined()
    expect(env.GOOGLE_CLIENT_SECRET).toBeUndefined()
  })

  it("requires both Google variables or neither", () => {
    expect(() => parseAuthEnv({ ...minimal, GOOGLE_CLIENT_ID: "id" })).toThrow(
      /GOOGLE_CLIENT_SECRET/,
    )
    expect(() => parseAuthEnv({ ...minimal, GOOGLE_CLIENT_SECRET: "secret" })).toThrow(
      /GOOGLE_CLIENT_ID/,
    )
    const env = parseAuthEnv({ ...minimal, GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" })
    expect(env.GOOGLE_CLIENT_ID).toBe("id")
  })

  it("requires RESEND_API_KEY when MAIL_PROVIDER is resend", () => {
    expect(() => parseAuthEnv({ ...minimal, MAIL_PROVIDER: "resend" })).toThrow(/RESEND_API_KEY/)
    const env = parseAuthEnv({ ...minimal, MAIL_PROVIDER: "resend", RESEND_API_KEY: "re_key" })
    expect(env.MAIL_PROVIDER).toBe("resend")
  })

  it("parses ADMIN_EMAILS into a lowercase list and defaults to none", () => {
    expect(parseAuthEnv(minimal).ADMIN_EMAILS).toEqual([])
    const env = parseAuthEnv({ ...minimal, ADMIN_EMAILS: " Admin@Example.com, ops@example.com ,," })
    expect(env.ADMIN_EMAILS).toEqual(["admin@example.com", "ops@example.com"])
  })

  it("rejects a non-address in ADMIN_EMAILS", () => {
    expect(() => parseAuthEnv({ ...minimal, ADMIN_EMAILS: "admin@example.com,nope" })).toThrow(
      /ADMIN_EMAILS/,
    )
  })

  it("rejects an unknown MAIL_PROVIDER", () => {
    expect(() => parseAuthEnv({ ...minimal, MAIL_PROVIDER: "smtp" })).toThrow(/MAIL_PROVIDER/)
  })
})
