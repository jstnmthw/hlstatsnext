"use client"

import { updateUserName } from "@/features/admin/users/actions/user-actions"
import {
  Button,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@repo/ui"
import { useState, useTransition } from "react"
import { toast } from "sonner"

interface EditUserSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  userName: string
  userEmail: string
}

export function EditUserSheet({
  open,
  onOpenChange,
  userId,
  userName,
  userEmail,
}: EditUserSheetProps) {
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(userName)

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateUserName(userId, name)
      if (result.success) {
        toast.success(result.message)
        onOpenChange(false)
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit User</SheetTitle>
          <SheetDescription>Update user details.</SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4">
          <div className="grid gap-2">
            <Label>Email</Label>
            <Input value={userEmail} disabled />
          </div>
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="User name" />
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending || name.trim() === userName}>
            {isPending ? "Saving..." : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
