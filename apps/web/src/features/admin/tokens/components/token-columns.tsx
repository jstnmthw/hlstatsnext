"use client"

import { revokeToken } from "@/features/admin/tokens/actions/revoke-token"
import { TokenListItem } from "@/features/admin/tokens/components/token-config"
import { DataTableColumnHeader } from "@/features/common/components/data-table-col-header"
import { useDataTableContext } from "@/features/common/components/data-table-context"
import { formatDate, formatHumanFriendlyDate } from "@/lib/datetime-util"
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
  Badge,
  Button,
  Checkbox,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconDots,
  IconRefresh,
} from "@repo/ui"
import { ColumnDef } from "@tanstack/react-table"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

function ActionsHeader() {
  const { onRefresh, isPending } = useDataTableContext()
  return (
    <div className="flex items-center justify-end pr-3 pl-1">
      <Button variant="ghost" className="group size-8 p-0" onClick={onRefresh} disabled={isPending}>
        <IconRefresh
          className={cn(
            "size-4",
            isPending ? "animate-spin" : "",
            "text-zinc-500 transition-colors duration-200 group-hover:text-zinc-100",
          )}
        />
      </Button>
    </div>
  )
}

function getStatusBadge(status: string) {
  switch (status) {
    case "active":
      return (
        <Badge variant="outline" colorScheme="green">
          Active
        </Badge>
      )
    case "revoked":
      return (
        <Badge variant="outline" colorScheme="red">
          Revoked
        </Badge>
      )
    case "expired":
      return (
        <Badge variant="outline" colorScheme="yellow">
          Expired
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" colorScheme="light">
          {status}
        </Badge>
      )
  }
}

export const tokenColumns = (): ColumnDef<TokenListItem>[] => [
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex max-w-10 items-center justify-center pr-3 pl-1">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex max-w-10 items-center justify-center pr-3 pl-1">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "tokenPrefix",
    header: () => <DataTableColumnHeader title="Token Prefix" field="tokenPrefix" />,
    cell: ({ row }) => (
      <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs">
        {row.original.tokenPrefix}...
      </code>
    ),
  },
  {
    accessorKey: "name",
    header: () => <DataTableColumnHeader title="Name" field="name" />,
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: "game",
    header: () => <DataTableColumnHeader title="Game" field="game" />,
    cell: ({ row }) => (
      <Badge variant="outline" colorScheme="blue">
        {row.original.game}
      </Badge>
    ),
  },
  {
    accessorKey: "status",
    header: () => <DataTableColumnHeader title="Status" field="status" />,
    cell: ({ row }) => getStatusBadge(row.original.status),
  },
  {
    accessorKey: "serverCount",
    header: () => <DataTableColumnHeader title="Servers" field="serverCount" />,
    cell: ({ row }) => <span>{row.original.serverCount}</span>,
  },
  {
    accessorKey: "hasRconPassword",
    header: () => <DataTableColumnHeader title="RCON" field="hasRconPassword" />,
    cell: ({ row }) => (
      <Badge variant="outline" colorScheme={row.original.hasRconPassword ? "green" : "light"}>
        {row.original.hasRconPassword ? "Yes" : "No"}
      </Badge>
    ),
  },
  {
    accessorKey: "lastUsedAt",
    header: () => <DataTableColumnHeader title="Last Used" field="lastUsedAt" />,
    cell: ({ row }) => {
      const token = row.original
      if (!token.lastUsedAt) return <span className="text-zinc-500">Never</span>
      return <span>{formatHumanFriendlyDate(token.lastUsedAt)}</span>
    },
  },
  {
    accessorKey: "createdAt",
    header: () => <DataTableColumnHeader title="Created" field="createdAt" />,
    cell: ({ row }) => <span>{formatDate(row.original.createdAt)}</span>,
  },
  {
    id: "actions",
    header: () => <ActionsHeader />,
    cell: ({ row }) => <TokenActions token={row.original} />,
  },
]

function TokenActions({ token }: { token: TokenListItem }) {
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
