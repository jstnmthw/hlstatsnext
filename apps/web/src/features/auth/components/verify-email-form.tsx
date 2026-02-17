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
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

const RESEND_COOLDOWN = 60

interface VerifyEmailFormProps {
  email: string
}

export function VerifyEmailForm({ email }: VerifyEmailFormProps) {
  const router = useRouter()
  const [otp, setOtp] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
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

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const { error: verifyError } = await authClient.emailOtp.verifyEmail({
      email,
      otp,
    })

    if (verifyError) {
      setError(verifyError.message ?? "Invalid code. Please try again.")
      setLoading(false)
      return
    }

    router.push("/login")
    router.refresh()
  }

  async function handleResend() {
    setError("")
    setSuccess("")
    setResending(true)

    const { error: resendError } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    })

    if (resendError) {
      setError(resendError.message ?? "Failed to resend code.")
    } else {
      setSuccess("A new code has been sent to your email.")
    }

    setResending(false)
    startCooldown()
  }

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight">Verify your email</h2>
        <p className="mt-1 text-muted-foreground">
          We sent a 6-digit code to <strong>{email}</strong>. Enter it below to verify your email
          address.
        </p>
      </div>

      <form onSubmit={handleVerify} className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-destructive">{error}</div>
        )}
        {success && (
          <div className="rounded-md bg-green-500/10 px-3 py-2 text-green-500">{success}</div>
        )}

        <div className="flex-col justify-center space-y-2 text-center">
          <Label>Verification code</Label>
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

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          disabled={loading || otp.length !== 6}
        >
          {loading ? "Verifying..." : "Verify email"}
        </Button>
      </form>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || cooldown > 0}
          className="text-primary hover:underline disabled:opacity-50"
        >
          {resending
            ? "Sending..."
            : cooldown > 0
              ? `Resend code in ${cooldown}s`
              : "Didn't receive a code? Resend"}
        </button>
      </div>
    </Card>
  )
}
