"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button, Card, Input, Label } from "@repo/ui"
import { authClient } from "@repo/auth/client"

export function ForgotPasswordForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const { error: requestError } = await authClient.emailOtp.requestPasswordReset({
      email,
    })

    if (requestError) {
      // Don't reveal whether the email exists — always redirect
    }

    // Always redirect to reset-password page (prevents user enumeration)
    router.push(`/reset-password?email=${encodeURIComponent(email)}`)
  }

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight">Forgot password</h2>
        <p className="text-muted-foreground mt-1">
          Enter your email address and we&apos;ll send you a code to reset your password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-destructive">{error}</div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <Button
          type="submit"
          variant="solid"
          colorScheme="indigo"
          className="w-full"
          disabled={loading}
        >
          {loading ? "Sending..." : "Send reset code"}
        </Button>
      </form>

      <p className="mt-6 text-center text-muted-foreground">
        Remember your password?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  )
}
