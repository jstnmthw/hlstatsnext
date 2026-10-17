"use client"

import { authErrorMessage } from "@/features/auth/lib/auth-error-messages"
import { authClient } from "@repo/auth/client"
import {
  Badge,
  Button,
  Input,
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
  Label,
} from "@repo/ui"
import { useRouter } from "next/navigation"
import { useState } from "react"

interface EmailFormProps {
  email: string
  emailVerified: boolean
}

// Two steps: a code goes to the new address, then the code confirms the change.
// Better Auth marks the new address verified, so a Steam-only account gains a
// real, recoverable email this way.
export function EmailForm({ email, emailVerified }: EmailFormProps) {
  const router = useRouter()
  const [newEmail, setNewEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [codeSent, setCodeSent] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)

  async function requestCode(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSuccess("")
    setLoading(true)

    const { error: requestError } = await authClient.emailOtp.requestEmailChange({ newEmail })
    setLoading(false)

    if (requestError) {
      setError(
        authErrorMessage(requestError.code, requestError.message ?? "Could not send a code."),
      )
      return
    }

    setCodeSent(true)
    setSuccess(`If ${newEmail} is available, a code is on its way.`)
  }

  async function confirmChange(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const { error: changeError } = await authClient.emailOtp.changeEmail({ newEmail, otp })
    setLoading(false)

    if (changeError) {
      setError(
        authErrorMessage(changeError.code, changeError.message ?? "Could not change the email."),
      )
      return
    }

    setSuccess("Email updated.")
    setCodeSent(false)
    setNewEmail("")
    setOtp("")
    router.refresh()
  }

  return (
    <form onSubmit={codeSent ? confirmChange : requestCode} className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-destructive">{error}</div>
      )}
      {success && (
        <div className="rounded-md bg-green-500/10 px-3 py-2 text-green-500">{success}</div>
      )}

      <div className="space-y-2">
        <Label>Current email</Label>
        <div className="flex items-center gap-2">
          <span className="truncate">{email}</span>
          <Badge variant={emailVerified ? "secondary" : "outline"}>
            {emailVerified ? "Verified" : "Unverified"}
          </Badge>
        </div>
        {!emailVerified && (
          <p className="text-xs text-muted-foreground">
            Add a verified email to recover your account and set a password.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-email">New email</Label>
        <Input
          id="new-email"
          type="email"
          placeholder="you@example.com"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          required
          disabled={codeSent}
          autoComplete="email"
        />
      </div>

      {codeSent && (
        <div className="space-y-2">
          <Label>Code from the new email</Label>
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
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" disabled={loading || (codeSent && otp.length < 6)}>
          {loading ? "Working..." : codeSent ? "Confirm new email" : "Send code"}
        </Button>
        {codeSent && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setCodeSent(false)
              setOtp("")
              setSuccess("")
            }}
          >
            Use a different address
          </Button>
        )}
      </div>
    </form>
  )
}
