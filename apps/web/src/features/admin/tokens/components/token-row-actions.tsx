"use client"

import { revokeToken } from "@/features/admin/tokens/actions/revoke-token"
import { TokenListItem } from "@/features/admin/tokens/components/token-config"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconDots,
} from "@repo/ui"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

interface TokenRowActionsProps {
  token: TokenListItem
}

export function TokenRowActions({ token }: TokenRowActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleRevoke = () => {
    startTransition(async () => {
      const result = await revokeToken(token.id)
      if (result.success) {
        router.refresh()
      }
    })
  }

  return (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex items-center justify-end pr-3 pl-1">
            <Button variant="ghost" className="size-8 p-0">
              <span className="sr-only">Open menu</span>
              <IconDots className="size-4" />
            </Button>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => navigator.clipboard.writeText(token.tokenPrefix)}>
            Copy token prefix
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {token.status === "active" ? (
            <AlertDialogTrigger asChild>
              <DropdownMenuItem className="text-red-400">
                {isPending ? "Revoking..." : "Revoke token"}
              </DropdownMenuItem>
            </AlertDialogTrigger>
          ) : (
            <DropdownMenuItem disabled className="text-zinc-500">
              Status: {token.status}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke Token</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to revoke <strong>{token.name}</strong> (
            <code className="text-xs">{token.tokenPrefix}...</code>)? Servers using this token will
            lose authentication within 60 seconds. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleRevoke} disabled={isPending}>
            {isPending ? "Revoking..." : "Revoke Token"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
