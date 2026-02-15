"use client"

import { useState } from "react"
import Link from "next/link"
import { Button, Card, Input, Label } from "@repo/ui"
import { authClient } from "@repo/auth/client"

interface ResetPasswordFormProps {
  email: string
}

export function ResetPasswordForm({ email }: ResetPasswordFormProps) {
  const [otp, setOtp] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const { error: resetError } = await authClient.emailOtp.resetPassword({
      email,
      otp,
      password,
    })

    if (resetError) {
      setError(resetError.message ?? "Failed to reset password. Please try again.")
      setLoading(false)
      return
    }

    setSuccess(true)
  }

  async function handleResend() {
    setError("")
    setResending(true)

    await authClient.emailOtp.requestPasswordReset({ email })

    setResending(false)
  }

  if (success) {
    return (
      <Card className="p-6 text-center">
        <h2 className="text-xl font-semibold tracking-tight mb-2">Password reset</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Your password has been reset successfully.
        </p>
        <Button variant="solid" colorScheme="indigo" asChild className="w-full">
          <Link href="/login">Sign in</Link>
        </Button>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight">Reset password</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Enter the code sent to <strong>{email}</strong> and choose a new password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="otp">Reset code</Label>
          <Input
            id="otp"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            required
            autoComplete="one-time-code"
            className="text-center text-lg tracking-widest"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        <Button
          type="submit"
          variant="solid"
          colorScheme="indigo"
          className="w-full"
          disabled={loading || otp.length !== 6}
        >
          {loading ? "Resetting..." : "Reset password"}
        </Button>
      </form>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="text-sm text-primary hover:underline disabled:opacity-50"
        >
          {resending ? "Sending..." : "Didn't receive a code? Resend"}
        </button>
      </div>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </Card>
  )
}
