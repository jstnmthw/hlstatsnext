"use client"

import { authErrorMessage } from "@/features/auth/lib/auth-error-messages"
import { signUp } from "@repo/auth/client"
import { Button, Card, Input, Label } from "@repo/ui"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { GoogleButton } from "./google-button"
import { OrDivider } from "./or-divider"
import { PasswordInput } from "./password-input"
import { SteamButton } from "./steam-button"

interface RegisterFormProps {
  googleEnabled: boolean
  errorCode?: string
}

export function RegisterForm({ googleEnabled, errorCode }: RegisterFormProps) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState(() =>
    errorCode ? authErrorMessage(errorCode, "Registration failed. Please try again.") : "",
  )
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setLoading(true)

    const { error: signUpError } = await signUp.email({
      name,
      email,
      password,
    })

    if (signUpError) {
      setError(signUpError.message ?? "Registration failed. Please try again.")
      setLoading(false)
      return
    }

    // Redirect to email verification page
    router.push(`/verify-email?email=${encodeURIComponent(email)}`)
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-lg font-bold tracking-tight uppercase">Create an account</h2>
        <p className="text-muted-foreground">
          Continue with Steam to claim your players, or register with your email.
        </p>
      </div>
      <Card className="p-6">
        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <SteamButton errorCallbackURL="/register">Continue with Steam</SteamButton>
          {googleEnabled && <GoogleButton />}
        </div>

        <OrDivider label="or with email" />

        <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
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

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <PasswordInput
              showToggle
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <Button
            type="submit"
            variant="outline"
            colorScheme="zinc"
            className="w-full"
            disabled={loading}
          >
            {loading ? "Creating account..." : "Create account with email"}
          </Button>
        </form>

        <p className="mt-6 text-center text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary-bright hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </>
  )
}
