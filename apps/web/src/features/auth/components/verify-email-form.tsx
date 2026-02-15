"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Card, Input, Label } from "@repo/ui"
import { authClient } from "@repo/auth/client"

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
  }

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight">Verify your email</h2>
        <p className="text-muted-foreground mt-1">
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

        <div className="space-y-2">
          <Label htmlFor="otp">Verification code</Label>
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

        <Button
          type="submit"
          variant="solid"
          colorScheme="indigo"
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
          disabled={resending}
          className="text-primary hover:underline disabled:opacity-50"
        >
          {resending ? "Sending..." : "Didn't receive a code? Resend"}
        </button>
      </div>
    </Card>
  )
}
