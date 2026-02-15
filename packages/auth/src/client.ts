"use client"

import { createAuthClient } from "better-auth/react"
import { adminClient } from "better-auth/client/plugins"
import { emailOTPClient } from "better-auth/client/plugins"
import { ac, adminRole, userRole } from "./permissions"

export const authClient = createAuthClient({
  plugins: [
    adminClient({
      ac,
      roles: {
        admin: adminRole,
        user: userRole,
      },
    }),
    emailOTPClient(),
  ],
})

export const { useSession, signIn, signUp, signOut } = authClient
