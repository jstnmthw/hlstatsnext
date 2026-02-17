"use client"

import { signIn } from "@repo/auth/client"
import { Button, Card, Input, Label } from "@repo/ui"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { GoogleButton } from "./google-button"
import { PasswordInput } from "./password-input"

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const { error: signInError } = await signIn.email({
      email,
      password,
    })

    if (signInError) {
      // 403 means email not verified — redirect to verification page
      if (signInError.status === 403) {
        router.push(`/verify-email?email=${encodeURIComponent(email)}`)
        return
      }
      setError(signInError.message ?? "Sign in failed. Please try again.")
      setLoading(false)
      return
    }

    router.push("/admin")
    router.refresh()
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-lg font-bold tracking-tight uppercase">Sign in</h2>
        <p className="text-muted-foreground">Enter your credentials to access the admin panel.</p>
      </div>
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-destructive">{error}</div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-sm text-muted-foreground hover:text-primary-bright hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              showToggle
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <Button type="submit" variant="primary" className="mt-2 w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        {googleEnabled && (
          <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or continue with</span>
              </div>
            </div>

            <GoogleButton />
          </>
        )}

        <p className="text-center text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-primary-bright hover:underline">
            Register
          </Link>
        </p>
      </Card>
    </>
  )
}
