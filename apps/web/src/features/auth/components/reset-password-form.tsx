"use client"

import { authClient } from "@repo/auth/client"
import {
  Button,
  Card,
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
  Label,
} from "@repo/ui"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { PasswordInput } from "./password-input"

const RESEND_COOLDOWN = 60

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
  const [resendSuccess, setResendSuccess] = useState("")
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN)
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!)
          intervalRef.current = null
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // Start countdown on mount (code was just sent)
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!)
          intervalRef.current = null
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

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
    setResendSuccess("")
    setResending(true)

    const { error: resendError } = await authClient.emailOtp.requestPasswordReset({ email })

    if (resendError) {
      setError(resendError.message ?? "Failed to resend code. Please try again.")
    } else {
      setResendSuccess("A new code has been sent to your email.")
    }

    setResending(false)
    startCooldown()
  }

  if (success) {
    return (
      <Card className="p-6 text-center">
        <h2 className="mb-2 text-xl font-semibold tracking-tight">Password reset</h2>
        <p className="mb-4 text-muted-foreground">Your password has been reset successfully.</p>
        <Button variant="primary" asChild className="w-full">
          <Link href="/login">Sign in</Link>
        </Button>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight">Reset password</h2>
        <p className="mt-1 text-muted-foreground">
          Enter the code sent to <strong>{email}</strong> and choose a new password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-destructive">{error}</div>
        )}
        {resendSuccess && (
          <div className="rounded-md bg-green-500/10 px-3 py-2 text-green-500">{resendSuccess}</div>
        )}

        <div className="space-y-2">
          <Label>Reset code</Label>
          <InputOTP maxLength={6} value={otp} onChange={setOtp} autoComplete="one-time-code">
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <PasswordInput
            showToggle
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        <Button
          type="submit"
          variant="primary"
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
          disabled={resending || cooldown > 0}
          className="text-primary-bright hover:underline disabled:opacity-50"
        >
          {resending
            ? "Sending..."
            : cooldown > 0
              ? `Resend code in ${cooldown}s`
              : "Didn't receive a code? Resend"}
        </button>
      </div>

      <p className="text-center text-muted-foreground">
        <Link href="/login" className="text-muted-foreground hover:underline">
          Back to sign in
        </Link>
      </p>
    </Card>
  )
}
