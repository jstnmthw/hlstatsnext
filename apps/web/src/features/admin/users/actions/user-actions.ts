"use server"

import type { ActionResult } from "@/lib/actions"
import { getAuth } from "@repo/auth/server"
import { requirePermission } from "@repo/auth/session"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

function preventSelfAction(sessionUserId: string, targetUserId: string): ActionResult | null {
  if (sessionUserId === targetUserId) {
    return { ok: false, message: "You cannot perform this action on yourself." }
  }
  return null
}

export async function banUser(
  userId: string,
  banReason?: string,
  banExpiresIn?: number,
): Promise<ActionResult> {
  const session = await requirePermission({ user: ["ban"] })

  const selfError = preventSelfAction(session.user.id, userId)
  if (selfError) return selfError

  try {
    await getAuth().api.banUser({
      body: {
        userId,
        ...(banReason && { banReason }),
        ...(banExpiresIn && { banExpiresIn }),
      },
      headers: await headers(),
    })

    revalidatePath("/admin/users")
    return { ok: true, message: "User has been banned." }
  } catch (e) {
    console.error("banUser error:", e)
    return { ok: false, message: "Failed to ban user." }
  }
}

export async function unbanUser(userId: string): Promise<ActionResult> {
  const session = await requirePermission({ user: ["ban"] })

  const selfError = preventSelfAction(session.user.id, userId)
  if (selfError) return selfError

  try {
    await getAuth().api.unbanUser({
      body: { userId },
      headers: await headers(),
    })

    revalidatePath("/admin/users")
    return { ok: true, message: "User has been unbanned." }
  } catch (e) {
    console.error("unbanUser error:", e)
    return { ok: false, message: "Failed to unban user." }
  }
}

export async function updateUserName(userId: string, name: string): Promise<ActionResult> {
  const session = await requirePermission({ user: ["update"] })

  const selfError = preventSelfAction(session.user.id, userId)
  if (selfError) return selfError

  try {
    const trimmed = name.trim()
    if (!trimmed) {
      return { ok: false, message: "Name cannot be empty." }
    }

    await getAuth().api.adminUpdateUser({
      body: { userId, data: { name: trimmed } },
      headers: await headers(),
    })

    revalidatePath("/admin/users")
    return { ok: true, message: "User name updated." }
  } catch (e) {
    console.error("updateUserName error:", e)
    return { ok: false, message: "Failed to update user name." }
  }
}

export async function changeUserRole(userId: string, role: string): Promise<ActionResult> {
  const session = await requirePermission({ user: ["set-role"] })

  const selfError = preventSelfAction(session.user.id, userId)
  if (selfError) return selfError

  try {
    await getAuth().api.setRole({
      body: { userId, role: role as "admin" | "user" },
      headers: await headers(),
    })

    revalidatePath("/admin/users")
    return { ok: true, message: `User role changed to ${role}.` }
  } catch (e) {
    console.error("changeUserRole error:", e)
    return { ok: false, message: "Failed to change user role." }
  }
}

export async function anonymizeUser(userId: string): Promise<ActionResult> {
  const session = await requirePermission({ user: ["delete"] })

  const selfError = preventSelfAction(session.user.id, userId)
  if (selfError) return selfError

  try {
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
    return { ok: true, message: "User account has been anonymized." }
  } catch (e) {
    console.error("anonymizeUser error:", e)
    return { ok: false, message: "Failed to anonymize user." }
  }
}
