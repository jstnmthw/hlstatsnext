"use client"

import { signUp } from "@repo/auth/client"
import { Button, Card, Input, Label } from "@repo/ui"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { GoogleButton } from "./google-button"

export function RegisterForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
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
        <p className="text-sm text-muted-foreground">Enter your details to create a new account.</p>
      </div>
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-destructive">{error}</div>
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
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
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

          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
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
