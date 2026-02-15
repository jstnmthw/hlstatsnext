import { DataTableColumnHeader } from "@/features/common/components/data-table-col-header"
import { FilterConfig } from "@/features/common/types/data-table"
import { formatDate } from "@/lib/datetime-util"
import { Server } from "@repo/database/client"
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
import { ColumnDef, HeaderContext } from "@tanstack/react-table"
import Link from "next/link"

interface ExtendedHeaderContext<TData, TValue> extends HeaderContext<TData, TValue> {
  sortField?: string
  sortOrder?: "asc" | "desc"
  onSort?: (field: string) => void
  onRefresh?: () => void
  isPending?: boolean
}

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
  serverId: string // GraphQL returns this as string
  lastEvent?: string | Date // GraphQL field is optional, could be string or Date
  __typename?: string // GraphQL metadata field
}

export const serverFilterConfig: FilterConfig = {
  columnId: "search",
  placeholder: "Filter servers...",
  label: "Server Search",
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
    header: (props: ExtendedHeaderContext<ServerListItem, unknown>) => (
      <DataTableColumnHeader
        title="ID"
        field="serverId"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const server = row.original
      return <span className="pl-2">{server.serverId}</span>
    },
  },
  {
    id: "status",
    accessorKey: "lastEvent",
    header: (props: ExtendedHeaderContext<ServerListItem, unknown>) => (
      <DataTableColumnHeader
        title="Status"
        field="lastEvent"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const server = row.original
      // Consider server online if it has recent activity (within last 30 minutes)
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
    header: (props: ExtendedHeaderContext<ServerListItem, unknown>) => (
      <DataTableColumnHeader
        title="Name"
        field="name"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const server = row.original
      return <span className="font-medium">{server.name || "Unnamed Server"}</span>
    },
  },
  {
    accessorKey: "address",
    header: (props: ExtendedHeaderContext<ServerListItem, unknown>) => (
      <DataTableColumnHeader
        title="Address"
        field="address"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const server = row.original
      return (
        <span className="font-mono">
          {server.address}:{server.port}
        </span>
      )
    },
  },
  {
    accessorKey: "game",
    header: (props: ExtendedHeaderContext<ServerListItem, unknown>) => (
      <DataTableColumnHeader
        title="Game"
        field="game"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
  },
  {
    accessorKey: "activePlayers",
    header: (props: ExtendedHeaderContext<ServerListItem, unknown>) => (
      <DataTableColumnHeader
        title="Players"
        field="activePlayers"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const server = row.original
      return (
        <span>
          {server.activePlayers}/{server.maxPlayers}
        </span>
      )
    },
  },
  {
    accessorKey: "activeMap",
    header: (props: ExtendedHeaderContext<ServerListItem, unknown>) => (
      <DataTableColumnHeader
        title="Current Map"
        field="activeMap"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const server = row.original
      return <span>{server.activeMap || "-"}</span>
    },
  },
  {
    id: "lastEventDate",
    accessorKey: "lastEvent",
    header: (props: ExtendedHeaderContext<ServerListItem, unknown>) => (
      <DataTableColumnHeader
        title="Last Event"
        field="lastEvent"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const server = row.original
      if (!server.lastEvent) return <span>-</span>
      return <span>{formatDate(server.lastEvent)}</span>
    },
  },
  {
    id: "actions",
    header: (props: ExtendedHeaderContext<ServerListItem, unknown>) => (
      <div className="flex items-center justify-end pr-3 pl-1">
        <Button
          variant="ghost"
          className="group size-8 p-0"
          onClick={props.onRefresh}
          disabled={props.isPending}
        >
          <IconRefresh
            className={cn(
              "size-4",
              props.isPending ? "animate-spin" : "",
              "text-zinc-500 transition-colors duration-200 group-hover:text-zinc-100",
            )}
          />
        </Button>
      </div>
    ),
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
