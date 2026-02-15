import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { admin } from "better-auth/plugins"
import { db } from "@repo/database/client"
import { ac, adminRole, userRole } from "./permissions"

const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "mysql" }),
  emailAndPassword: { enabled: true },
  ...(googleClientId && googleClientSecret
    ? {
        socialProviders: {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        },
      }
    : {}),
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
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
  ],
})

export { toNextJsHandler } from "better-auth/next-js"

export type Auth = typeof auth
export type Session = Awaited<ReturnType<typeof auth.api.getSession>> & {}
