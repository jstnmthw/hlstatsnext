"use client"

import { banUser, unbanUser } from "@/features/admin/users/actions/user-actions"
import { formatDate } from "@/lib/datetime-util"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@repo/ui"
import { useState, useTransition } from "react"
import { toast } from "sonner"

interface BanUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  userName: string
  isBanned: boolean
  banReason?: string | null
  banExpires?: string | Date | null
}

const BAN_REASONS = [
  { label: "Spam", value: "Spam" },
  { label: "Harassment", value: "Harassment" },
  { label: "Inappropriate content", value: "Inappropriate content" },
  { label: "ToS violation", value: "ToS violation" },
  { label: "Other", value: "other" },
]

const BAN_DURATIONS = [
  { label: "Permanent", value: "0" },
  { label: "1 hour", value: String(60 * 60) },
  { label: "1 day", value: String(60 * 60 * 24) },
  { label: "7 days", value: String(60 * 60 * 24 * 7) },
  { label: "30 days", value: String(60 * 60 * 24 * 30) },
  { label: "Custom", value: "custom" },
]

export function BanUserDialog({
  open,
  onOpenChange,
  userId,
  userName,
  isBanned,
  banReason: currentBanReason,
  banExpires,
}: BanUserDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [reason, setReason] = useState("")
  const [customReason, setCustomReason] = useState("")
  const [duration, setDuration] = useState("0")
  const [customDays, setCustomDays] = useState("")

  const handleBan = () => {
    const finalReason = reason === "other" ? customReason.trim() : reason
    let banExpiresIn: number | undefined
    if (duration === "custom") {
      const days = Number(customDays)
      if (days > 0) banExpiresIn = days * 60 * 60 * 24
    } else if (duration !== "0") {
      banExpiresIn = Number(duration)
    }

    startTransition(async () => {
      const result = await banUser(userId, finalReason || undefined, banExpiresIn)
      if (result.success) {
        toast.success(result.message)
        onOpenChange(false)
      } else {
        toast.error(result.message)
      }
    })
  }

  const handleUnban = () => {
    startTransition(async () => {
      const result = await unbanUser(userId)
      if (result.success) {
        toast.success(result.message)
        onOpenChange(false)
      } else {
        toast.error(result.message)
      }
    })
  }

  if (isBanned) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unban {userName}</AlertDialogTitle>
            <AlertDialogDescription>
              This user is currently banned.
              {currentBanReason && (
                <>
                  <br />
                  <span className="font-medium">Reason:</span> {currentBanReason}
                </>
              )}
              {banExpires && (
                <>
                  <br />
                  <span className="font-medium">Expires:</span> {formatDate(banExpires)}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnban} disabled={isPending}>
              {isPending ? "Unbanning..." : "Unban user"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ban {userName}</AlertDialogTitle>
          <AlertDialogDescription>
            This will ban the user and revoke all their active sessions.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {BAN_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {reason === "other" && (
            <div className="grid gap-2">
              <Label>Custom reason</Label>
              <Textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Describe the reason..."
                rows={3}
              />
            </div>
          )}

          <div className="grid gap-2">
            <Label>Duration</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BAN_DURATIONS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {duration === "custom" && (
            <div className="grid gap-2">
              <Label>Number of days</Label>
              <Input
                type="number"
                min={1}
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
                placeholder="e.g. 14"
              />
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleBan}
            disabled={isPending}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {isPending ? "Banning..." : "Ban user"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
