"use client"

import { changeUserRole } from "@/features/admin/users/actions/user-actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui"
import { useState, useTransition } from "react"
import { toast } from "sonner"

interface ChangeRoleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  userName: string
  currentRole: string
}

const ROLES = [
  { label: "Admin", value: "admin" },
  { label: "User", value: "user" },
]

export function ChangeRoleDialog({
  open,
  onOpenChange,
  userId,
  userName,
  currentRole,
}: ChangeRoleDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [role, setRole] = useState(currentRole)

  const handleSave = () => {
    startTransition(async () => {
      const result = await changeUserRole(userId, role)
      if (result.success) {
        toast.success(result.message)
        onOpenChange(false)
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Change Role for {userName}</AlertDialogTitle>
          <AlertDialogDescription>
            Current role: <span className="font-medium capitalize">{currentRole}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>New role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleSave} disabled={isPending || role === currentRole}>
            {isPending ? "Saving..." : "Change role"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
