"use client"

import { PasswordInput } from "@/features/auth/components/password-input"
import { authClient } from "@repo/auth/client"
import { Button, Label } from "@repo/ui"
import { useState } from "react"

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.")
      return
    }

    setLoading(true)

    const { error: changeError } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: false,
    })

    if (changeError) {
      setError(changeError.message ?? "Failed to change password.")
      setLoading(false)
      return
    }

    setSuccess("Password changed successfully.")
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-destructive">{error}</div>
      )}
      {success && (
        <div className="rounded-md bg-green-500/10 px-3 py-2 text-green-500">{success}</div>
      )}

      <div className="space-y-2">
        <Label htmlFor="current-password">Current Password</Label>
        <PasswordInput
          showToggle
          id="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-password">New Password</Label>
        <PasswordInput
          showToggle
          id="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-new-password">Confirm New Password</Label>
        <PasswordInput
          showToggle
          id="confirm-new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <Button type="submit" variant="primary" disabled={loading}>
        {loading ? "Changing password..." : "Change password"}
      </Button>
    </form>
  )
}
