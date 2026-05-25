import { DataTableActionsHeader } from "@/features/common/components/data-table-actions-header"
import { DataTableColumnHeader } from "@/features/common/components/data-table-col-header"
import { createSelectColumn } from "@/features/common/components/data-table-select-column"
import { DataTableConfig } from "@/features/common/types/data-table"
import { formatDate } from "@/lib/datetime-util"
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconDots,
} from "@repo/ui"
import { ColumnDef } from "@tanstack/react-table"
import Link from "next/link"

export type ServerListItem = {
  serverId?: number | null
  name?: string | null
  address?: string | null
  port?: number | null
  activePlayers?: number | null
  maxPlayers?: number | null
  activeMap?: string | null
  game?: string | null
  city?: string | null
  country?: string | null
  lastEvent?: string | Date | null
  __typename?: string
}

export const serverTableConfig: DataTableConfig = {
  defaultSortField: "name",
  defaultSortOrder: "asc",
  defaultPageSize: 10,
  searchFields: ["name", "address", "game"],
  filterPlaceholder: "Filter servers...",
  filters: [
    {
      id: "status",
      title: "Status",
      options: [
        { label: "Online", value: "online" },
        { label: "Offline", value: "offline" },
      ],
    },
  ],
  frozenColumnsLeft: ["select"],
  frozenColumnsRight: ["actions"],
}

export const serverColumns = (): ColumnDef<ServerListItem>[] => [
  createSelectColumn<ServerListItem>(),
  {
    accessorKey: "serverId",
    header: () => <DataTableColumnHeader title="ID" field="serverId" />,
    cell: ({ row }) => <span className="pl-2">{row.original.serverId}</span>,
  },
  {
    id: "status",
    accessorKey: "lastEvent",
    header: () => <DataTableColumnHeader title="Status" field="lastEvent" />,
    cell: ({ row }) => {
      const server = row.original
      const isOnline =
        server.lastEvent && new Date(server.lastEvent).getTime() > Date.now() - 30 * 60 * 1000
      return (
        <Badge variant="outline" colorScheme={isOnline ? "green" : "light"}>
          {isOnline ? "Online" : "Offline"}
        </Badge>
      )
    },
  },
  {
    accessorKey: "name",
    header: () => <DataTableColumnHeader title="Name" field="name" />,
    cell: ({ row }) => <span className="font-medium">{row.original.name || "Unnamed Server"}</span>,
  },
  {
    accessorKey: "address",
    header: () => <DataTableColumnHeader title="Address" field="address" />,
    cell: ({ row }) => (
      <span>
        {row.original.address}:{row.original.port}
      </span>
    ),
  },
  {
    accessorKey: "game",
    header: () => <DataTableColumnHeader title="Game" field="game" />,
  },
  {
    accessorKey: "activePlayers",
    header: () => <DataTableColumnHeader title="Players" field="activePlayers" />,
    cell: ({ row }) => (
      <span>
        {row.original.activePlayers}/{row.original.maxPlayers}
      </span>
    ),
  },
  {
    accessorKey: "activeMap",
    header: () => <DataTableColumnHeader title="Current Map" field="activeMap" />,
    cell: ({ row }) => <span>{row.original.activeMap || "-"}</span>,
  },
  {
    id: "lastEventDate",
    accessorKey: "lastEvent",
    header: () => <DataTableColumnHeader title="Last Event" field="lastEvent" />,
    cell: ({ row }) => {
      const server = row.original
      if (!server.lastEvent) return <span>-</span>
      return <span>{formatDate(server.lastEvent)}</span>
    },
  },
  {
    id: "actions",
    header: () => <DataTableActionsHeader />,
    cell: ({ row }) => {
      const server = row.original
      return (
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
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(String(server.serverId ?? ""))}
            >
              Copy server ID
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(`${server.address}:${server.port}`)}
            >
              Copy server address
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>View server details</DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/admin/servers/${server.serverId}/edit`}>Edit server</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
