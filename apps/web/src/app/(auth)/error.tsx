"use client"

import { Button, Card, IconAlertTriangle } from "@repo/ui"
import { useEffect } from "react"

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <Card className="p-6 text-center">
      <IconAlertTriangle className="mx-auto mb-4 size-10 text-destructive" />
      <h2 className="mb-2 text-lg font-semibold">Something went wrong</h2>
      <p className="mb-4 text-muted-foreground">
        {error.message || "An unexpected error occurred."}
      </p>
      <Button variant="solid" colorScheme="indigo" onClick={reset}>
        Try again
      </Button>
    </Card>
  )
}
