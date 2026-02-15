"use client"

import { useEffect } from "react"
import { Button, Card, IconAlertTriangle } from "@repo/ui"

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
        <h2 className="mb-2 text-lg font-semibold">Something went wrong</h2>
        <p className="mb-4 text-muted-foreground">
          {error.message || "An unexpected error occurred in the admin panel."}
        </p>
        <Button variant="solid" colorScheme="indigo" onClick={reset}>
          Try again
        </Button>
      </Card>
    </div>
  )
}
