import { DataTableColumnHeader } from "@/features/common/components/data-table-col-header"
import { useDataTableContext } from "@/features/common/components/data-table-context"
import { DataTableConfig } from "@/features/common/types/data-table"
import { formatDate } from "@/lib/datetime-util"
import { Server } from "@repo/db/client"
import {
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
import Link from "next/link"

export type ServerListItem = Pick<
  Server,
  | "name"
  | "address"
  | "port"
  | "activePlayers"
  | "maxPlayers"
  | "activeMap"
  | "game"
  | "city"
  | "country"
> & {
  serverId: string
  lastEvent?: string | Date
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
}

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

export const serverColumns = (): ColumnDef<ServerListItem>[] => [
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
    header: () => <ActionsHeader />,
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
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(server.serverId)}>
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
