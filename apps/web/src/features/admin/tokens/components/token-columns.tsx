"use client"

import { TokenListItem } from "@/features/admin/tokens/components/token-config"
import { TokenRowActions } from "@/features/admin/tokens/components/token-row-actions"
import { DataTableActionsHeader } from "@/features/common/components/data-table-actions-header"
import { DataTableColumnHeader } from "@/features/common/components/data-table-col-header"
import { createSelectColumn } from "@/features/common/components/data-table-select-column"
import { formatDate, formatHumanFriendlyDate } from "@/lib/datetime-util"
import { Badge } from "@repo/ui"
import { ColumnDef } from "@tanstack/react-table"

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
  createSelectColumn<TokenListItem>(),
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
    header: () => <DataTableActionsHeader />,
    cell: ({ row }) => <TokenRowActions token={row.original} />,
  },
]
