"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button, IconLogout, IconSettings, IconShield } from "@repo/ui"
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui"
import { signOut } from "@repo/auth/client"

export interface AccountMenuProps {
  user: {
    username?: string | null
    name?: string | null
    email: string
    image?: string | null
  }
  isAdmin?: boolean
}

function getInitial(name: string | null | undefined, email: string): string {
  if (name) {
    return name[0]!.toUpperCase()
  }
  return email[0]!.toUpperCase()
}

export function AccountMenu({ user, isAdmin = false }: AccountMenuProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar>
            {user.image && <AvatarImage src={user.image} alt={user.name || "User"} />}
            <AvatarFallback>{getInitial(user.name, user.email)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{user.username || user.name || "User"}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/accounts/settings">
            <IconSettings data-slot="icon" />
            Settings
          </Link>
        </DropdownMenuItem>
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin">
                <IconShield data-slot="icon" />
                Admin
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
          <IconLogout data-slot="icon" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
