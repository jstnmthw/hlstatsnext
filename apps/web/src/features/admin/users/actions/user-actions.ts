"use server"

import { hasPermission, type Permissions } from "@repo/auth/permissions"
import { getAuth } from "@repo/auth/server"
import { getSession, type Session } from "@repo/auth/session"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

interface ActionResult {
  success: boolean
  message: string
}

async function requirePermission(
  permissions: Permissions,
): Promise<{ session: Session; error?: never } | { error: ActionResult; session?: never }> {
  const session = await getSession()
  if (!session) {
    return { error: { success: false, message: "Authentication required." } }
  }

  if (!hasPermission(session.user.role, permissions)) {
    return { error: { success: false, message: "Insufficient permissions." } }
  }

  return { session }
}

function preventSelfAction(sessionUserId: string, targetUserId: string): ActionResult | null {
  if (sessionUserId === targetUserId) {
    return { success: false, message: "You cannot perform this action on yourself." }
  }
  return null
}

export async function banUser(
  userId: string,
  banReason?: string,
  banExpiresIn?: number,
): Promise<ActionResult> {
  try {
    const { session, error } = await requirePermission({ user: ["ban"] })
    if (error) return error

    const selfError = preventSelfAction(session.user.id, userId)
    if (selfError) return selfError

    await getAuth().api.banUser({
      body: {
        userId,
        ...(banReason && { banReason }),
        ...(banExpiresIn && { banExpiresIn }),
      },
      headers: await headers(),
    })

    revalidatePath("/admin/users")
    return { success: true, message: "User has been banned." }
  } catch (e) {
    console.error("banUser error:", e)
    return { success: false, message: "Failed to ban user." }
  }
}

export async function unbanUser(userId: string): Promise<ActionResult> {
  try {
    const { session, error } = await requirePermission({ user: ["ban"] })
    if (error) return error

    const selfError = preventSelfAction(session.user.id, userId)
    if (selfError) return selfError

    await getAuth().api.unbanUser({
      body: { userId },
      headers: await headers(),
    })

    revalidatePath("/admin/users")
    return { success: true, message: "User has been unbanned." }
  } catch (e) {
    console.error("unbanUser error:", e)
    return { success: false, message: "Failed to unban user." }
  }
}

export async function updateUserName(userId: string, name: string): Promise<ActionResult> {
  try {
    const { session, error } = await requirePermission({ user: ["update"] })
    if (error) return error

    const selfError = preventSelfAction(session.user.id, userId)
    if (selfError) return selfError

    const trimmed = name.trim()
    if (!trimmed) {
      return { success: false, message: "Name cannot be empty." }
    }

    await getAuth().api.adminUpdateUser({
      body: { userId, data: { name: trimmed } },
      headers: await headers(),
    })

    revalidatePath("/admin/users")
    return { success: true, message: "User name updated." }
  } catch (e) {
    console.error("updateUserName error:", e)
    return { success: false, message: "Failed to update user name." }
  }
}

export async function changeUserRole(userId: string, role: string): Promise<ActionResult> {
  try {
    const { session, error } = await requirePermission({ user: ["set-role"] })
    if (error) return error

    const selfError = preventSelfAction(session.user.id, userId)
    if (selfError) return selfError

    await getAuth().api.setRole({
      body: { userId, role: role as "admin" | "user" },
      headers: await headers(),
    })

    revalidatePath("/admin/users")
    return { success: true, message: `User role changed to ${role}.` }
  } catch (e) {
    console.error("changeUserRole error:", e)
    return { success: false, message: "Failed to change user role." }
  }
}

export async function anonymizeUser(userId: string): Promise<ActionResult> {
  try {
    const { session, error } = await requirePermission({ user: ["delete"] })
    if (error) return error

    const selfError = preventSelfAction(session.user.id, userId)
    if (selfError) return selfError

    // Setting `banned` through the endpoint also deletes the user's sessions.
    await getAuth().api.adminUpdateUser({
      body: {
        userId,
        data: {
          name: "[Deleted User]",
          email: `deleted-${userId}@removed.local`,
          image: null,
          banned: true,
          banReason: "Account anonymized by administrator",
        },
      },
      headers: await headers(),
    })

    revalidatePath("/admin/users")
    return { success: true, message: "User account has been anonymized." }
  } catch (e) {
    console.error("anonymizeUser error:", e)
    return { success: false, message: "Failed to anonymize user." }
  }
}
