import { headers } from "next/headers"
import { auth } from "./server"

export class AuthError extends Error {
  code: string
  statusCode: number

  constructor(code: string, message: string, statusCode = 401) {
    super(message)
    this.name = "AuthError"
    this.code = code
    this.statusCode = statusCode
  }
}

export type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>

/**
 * Get the current session, or null if not authenticated.
 * Wraps the `headers()` call so callers don't need to import it.
 */
export async function getSession(): Promise<Session | null> {
  return auth.api.getSession({ headers: await headers() })
}

/**
 * Get the current session, or throw an AuthError if not authenticated.
 */
export async function requireAuth(): Promise<Session> {
  const session = await getSession()
  if (!session) {
    throw new AuthError("UNAUTHORIZED", "Authentication required.")
  }
  return session
}
