"use client"

import { useRouter } from "next/navigation"
import { Button } from "@repo/ui"
import { IconLogout } from "@repo/ui"
import { signOut, useSession } from "@repo/auth/client"

export function UserMenu() {
  const router = useRouter()
  const { data: session } = useSession()

  if (!session) return null

  async function handleSignOut() {
    await signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-zinc-400">{session.user.name || session.user.email}</span>
      <Button variant="outline" colorScheme="zinc" size="icon-sm" onClick={handleSignOut}>
        <IconLogout className="size-4" aria-label="Sign out" />
      </Button>
    </div>
  )
}
