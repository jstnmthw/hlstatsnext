"use client"

import { authClient } from "@repo/auth/client"
import { Button, IconBrandSteam } from "@repo/ui"
import { useState } from "react"

interface SteamButtonProps {
  /** Where Steam sends the browser back with ?error=CODE when the sign-in fails. */
  errorCallbackURL: string
  children?: React.ReactNode
}

// The client follows the redirect in Better Auth's response, so a successful
// call leaves the page; only a failure returns here.
export function SteamButton({
  errorCallbackURL,
  children = "Continue with Steam",
}: SteamButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleClick() {
    setLoading(true)
    setError("")

    const { error: loginError } = await authClient.steam.login({
      callbackURL: "/accounts",
      errorCallbackURL,
    })

    if (loginError) {
      setError(loginError.message ?? "Steam sign-in failed. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="primary"
        className="w-full"
        onClick={handleClick}
        disabled={loading}
      >
        <IconBrandSteam className="mr-2 size-4" />
        {loading ? "Redirecting to Steam..." : children}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
