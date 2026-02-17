"use client"

import { authClient, useSession } from "@repo/auth/client"
import { Button, Input, Label } from "@repo/ui"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function ProfileForm() {
  const router = useRouter()
  const { data: session } = useSession()
  const [name, setName] = useState(session?.user.name ?? "")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSuccess("")
    setLoading(true)

    const { error: updateError } = await authClient.updateUser({ name })

    if (updateError) {
      setError(updateError.message ?? "Failed to update profile.")
      setLoading(false)
      return
    }

    setSuccess("Profile updated successfully.")
    setLoading(false)
    router.refresh()
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
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={session?.user.email ?? ""}
          disabled
          className="opacity-60"
        />
        <p className="text-xs text-muted-foreground">Email changes are not currently supported.</p>
      </div>

      <Button type="submit" variant="primary" disabled={loading}>
        {loading ? "Saving..." : "Save changes"}
      </Button>
    </form>
  )
}
