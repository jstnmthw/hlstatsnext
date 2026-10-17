import { db } from "@repo/db/client"
import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { admin, emailOTP } from "better-auth/plugins"
import { getEnv } from "./env"
import { sendOTP } from "./mail"
import { ac, adminRole, userRole } from "./permissions"

function buildAuth() {
  const env = getEnv()

  // Better Auth's requestPasswordResetEmailOTP endpoint doesn't clean up old
  // verification records before creating new ones (unlike sendVerificationOTP
  // which catches P2002 and retries). This extension adds that missing logic.
  const authDb = db.$extends({
    query: {
      verification: {
        async create({ args, query }) {
          try {
            return await query(args)
          } catch (error: unknown) {
            const isUniqueViolation =
              error != null &&
              typeof error === "object" &&
              "code" in error &&
              error.code === "P2002"
            if (isUniqueViolation) {
              const identifier = (args.data as Record<string, unknown>)?.identifier
              if (typeof identifier === "string") {
                await db.verification.deleteMany({ where: { identifier } })
                return await query(args)
              }
            }
            throw error
          }
        },
      },
    },
  })

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    database: prismaAdapter(authDb as any, { provider: "mysql" }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
    },
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google"],
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
    },
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          socialProviders: {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          },
        }
      : {}),
    session: {
      // Better Auth's defaults, written out so the lifetimes sit beside the cache they interact with.
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
    },
    rateLimit: {
      window: 60,
      max: 100,
      customRules: {
        "/sign-up/email": { window: 60, max: 3 },
        "/email-otp/send-verification-otp": { window: 60, max: 3 },
        "/email-otp/request-password-reset": { window: 60, max: 3 },
        "/forget-password/*": { window: 60, max: 3 },
      },
    },
    plugins: [
      admin({
        ac,
        roles: {
          admin: adminRole,
          user: userRole,
        },
      }),
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        sendVerificationOnSignUp: true,
        async sendVerificationOTP({ email, otp, type }) {
          // Fire-and-forget to avoid timing attacks
          void sendOTP({ email, otp, type })
        },
      }),
    ],
  })
}

export type Auth = ReturnType<typeof buildAuth>
export type Session = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>

let instance: Auth | undefined

// Built on first use rather than at import, so `next build` and unit tests can
// load this module without an environment. The apps call it once at startup.
export function getAuth(): Auth {
  instance ??= buildAuth()
  return instance
}

export { toNextJsHandler } from "better-auth/next-js"
