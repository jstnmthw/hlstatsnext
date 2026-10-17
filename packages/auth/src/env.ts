import { z } from "zod"

const generateHint = "generate one with: openssl rand -base64 32"

const schema = z
  .object({
    BETTER_AUTH_SECRET: z
      .string(`BETTER_AUTH_SECRET is required; ${generateHint}`)
      .min(32, `BETTER_AUTH_SECRET must be at least 32 characters; ${generateHint}`),
    BETTER_AUTH_URL: z.url("BETTER_AUTH_URL must be an absolute URL such as http://localhost:3000"),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    MAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
    MAIL_FROM: z.string().default("noreply@hlstatsnext.com"),
    RESEND_API_KEY: z.string().optional(),
    ADMIN_EMAILS: z
      .string()
      .optional()
      .transform((value) =>
        value
          ? value
              .split(",")
              .map((email) => email.trim().toLowerCase())
              .filter(Boolean)
          : [],
      )
      .pipe(z.array(z.email("ADMIN_EMAILS must be a comma-separated list of email addresses"))),
  })
  .superRefine((env, ctx) => {
    if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) {
      ctx.addIssue({
        code: "custom",
        path: [env.GOOGLE_CLIENT_ID ? "GOOGLE_CLIENT_SECRET" : "GOOGLE_CLIENT_ID"],
        message: "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together",
      })
    }
    if (env.MAIL_PROVIDER === "resend" && !env.RESEND_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message: "RESEND_API_KEY is required when MAIL_PROVIDER=resend",
      })
    }
  })

export type AuthEnv = z.infer<typeof schema>

// A blank line in a .env file must not count as a configured value, or an empty
// GOOGLE_CLIENT_ID would fail the pairing check instead of leaving Google off.
function withoutBlanks(source: NodeJS.ProcessEnv): Record<string, string> {
  const entries: Record<string, string> = {}
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string" && value.trim() !== "") {
      entries[key] = value
    }
  }
  return entries
}

export function parseAuthEnv(source: NodeJS.ProcessEnv = process.env): AuthEnv {
  const result = schema.safeParse(withoutBlanks(source))
  if (result.success) {
    return result.data
  }
  const lines = result.error.issues.map(
    (issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`,
  )
  throw new Error(`[auth] Invalid environment:\n${lines.join("\n")}`)
}

let cached: AuthEnv | undefined

/** Parse the auth variables once; later calls return the same object. */
export function getEnv(): AuthEnv {
  cached ??= parseAuthEnv()
  return cached
}
