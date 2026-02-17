"use client"

import { UserListItem } from "@/features/admin/users/components/user-columns"
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconBan,
  IconDots,
  IconEdit,
  IconShield,
  IconTrash,
} from "@repo/ui"
import { useState } from "react"
import { toast } from "sonner"
import { BanUserDialog } from "./ban-user-dialog"
import { ChangeRoleDialog } from "./change-role-dialog"
import { DeleteUserDialog } from "./delete-user-dialog"
import { EditUserSheet } from "./edit-user-sheet"

interface UserRowActionsProps {
  user: UserListItem
}

export function UserRowActions({ user }: UserRowActionsProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [roleOpen, setRoleOpen] = useState(false)
  const [banOpen, setBanOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex items-center justify-end pr-3 pl-1">
            <Button variant="ghost" className="size-8 p-0">
              <span className="sr-only">Open menu</span>
              <IconDots className="size-4" />
            </Button>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => {
              navigator.clipboard.writeText(user.email)
              toast.info("Email copied to clipboard")
            }}
          >
            Copy email
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <IconEdit className="mr-2 size-4" />
            Edit user
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setRoleOpen(true)}>
            <IconShield className="mr-2 size-4" />
            Change role
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setBanOpen(true)}>
            <IconBan className="mr-2 size-4" />
            {user.banned ? "Unban user" : "Ban user"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="text-red-400 focus:text-red-300"
          >
            <IconTrash className="mr-2 size-4" />
            Remove user
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditUserSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        userId={user.id}
        userName={user.name}
        userEmail={user.email}
      />

      <ChangeRoleDialog
        open={roleOpen}
        onOpenChange={setRoleOpen}
        userId={user.id}
        userName={user.name}
        currentRole={user.role || "user"}
      />

      <BanUserDialog
        open={banOpen}
        onOpenChange={setBanOpen}
        userId={user.id}
        userName={user.name}
        isBanned={!!user.banned}
        banReason={user.banReason}
        banExpires={user.banExpires}
      />

      <DeleteUserDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        userId={user.id}
        userName={user.name}
      />
    </>
  )
}
