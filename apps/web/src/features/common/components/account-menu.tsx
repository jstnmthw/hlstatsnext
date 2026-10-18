"use client"

import { signOut } from "@repo/auth/client"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconLogout,
  IconSettings,
  IconShield,
  IconUser,
} from "@repo/ui"
import Link from "next/link"
import { useRouter } from "next/navigation"

export interface AccountMenuProps {
  user: {
    username?: string | null
    name?: string | null
    email: string
    image?: string | null
  }
  isAdmin?: boolean
}

export function AccountMenu({ user, isAdmin = false }: AccountMenuProps) {
  const router = useRouter()
  const label = user.username || user.name || user.email

  const handleSignOut = async () => {
    await signOut()
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="px-2.5 font-normal text-muted-foreground">
          <Avatar size="sm" shape="square">
            {user.image && <AvatarImage src={user.image} alt="" />}
            <AvatarFallback>{label.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{label}</p>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/accounts/players">
            <IconUser data-slot="icon" />
            My players
          </Link>
        </DropdownMenuItem>
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
