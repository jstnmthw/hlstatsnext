"use client"

import { Button, Card, IconAlertTriangle } from "@repo/ui"
import { useEffect } from "react"

export default function AdminError({
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
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <Card className="max-w-md p-6 text-center">
        <IconAlertTriangle className="mx-auto mb-4 size-10 text-destructive" />
        <h2 className="mb-2 text-lg font-semibold uppercase">Something went wrong</h2>
        <p className="mb-4 text-muted-foreground">
          {error.message || "An unexpected error occurred in the admin panel."}
        </p>
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
      </Card>
    </div>
  )
}
