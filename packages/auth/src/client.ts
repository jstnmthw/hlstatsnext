"use client"

import { adminClient, emailOTPClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"
import { ac, roles } from "./permissions"

export const authClient = createAuthClient({
  plugins: [
    adminClient({
      ac,
      roles,
    }),
    emailOTPClient(),
  ],
})

export const { useSession, signIn, signUp, signOut } = authClient
