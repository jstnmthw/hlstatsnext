import "server-only"

import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { cache } from "react"
import { hasPermission, isAdmin, type Permissions } from "./permissions"
import { getAuth, type Session } from "./server"

export type { Session }

/**
 * The current session, or null. Cached per request, so a layout, a page, its
 * data modules and its actions can each ask for the price of one lookup.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const requestHeaders = await headers()
  return getAuth().api.getSession({ headers: requestHeaders })
})

/** Sends a visitor without a valid session to the sign-in page. */
export async function requireAuth(): Promise<Session> {
  const session = await getSession()
  if (!session) redirect("/login")
  return session
}

/** A signed-in non-admin gets a 404, so admin routes do not reveal that they exist. */
export async function requireAdmin(): Promise<Session> {
  const session = await requireAuth()
  if (!isAdmin(session.user)) notFound()
  return session
}

export async function requirePermission(permissions: Permissions): Promise<Session> {
  const session = await requireAuth()
  if (!hasPermission(session.user.role, permissions)) notFound()
  return session
}
