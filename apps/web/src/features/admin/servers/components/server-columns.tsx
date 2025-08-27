import {
  Button,
  Checkbox,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui"
import { Server } from "@repo/database/client"
import { ColumnDef } from "@tanstack/react-table"
import { formatDate } from "@/lib/datetime-util"
import { FilterConfig } from "@/features/common/types/data-table"
import { DataTableColumnHeader } from "@/features/common/components/data-table-col-header"
import { MoreHorizontal, RotateCw } from "lucide-react"

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

interface ServerColumnsContext {
  sortField?: string
  sortOrder?: "asc" | "desc"
  onSort: (field: string) => void
  onRefresh: () => void
  isPending?: boolean
}

export const serverColumns = (context: ServerColumnsContext): ColumnDef<ServerListItem>[] => [
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center pr-3 pl-1 max-w-10">
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
      <div className="flex items-center justify-center pr-3 pl-1 max-w-10">
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
    header: () => (
      <DataTableColumnHeader
        title="ID"
        field="serverId"
        sortField={context.sortField}
        sortOrder={context.sortOrder}
        onSort={context.onSort}
      />
    ),
    cell: ({ row }) => {
      const server = row.original
      return <span className="pl-2">{server.serverId}</span>
    },
  },
  {
    accessorKey: "name",
    header: () => (
      <DataTableColumnHeader
        title="Name"
        field="name"
        sortField={context.sortField}
        sortOrder={context.sortOrder}
        onSort={context.onSort}
      />
    ),
    cell: ({ row }) => {
      const server = row.original
      return <span className="font-medium">{server.name || "Unnamed Server"}</span>
    },
  },
  {
    accessorKey: "address",
    header: () => (
      <DataTableColumnHeader
        title="Address"
        field="address"
        sortField={context.sortField}
        sortOrder={context.sortOrder}
        onSort={context.onSort}
      />
    ),
    cell: ({ row }) => {
      const server = row.original
      return (
        <span className="font-mono text-sm">
          {server.address}:{server.port}
        </span>
      )
    },
  },
  {
    accessorKey: "game",
    header: () => (
      <DataTableColumnHeader
        title="Game"
        field="game"
        sortField={context.sortField}
        sortOrder={context.sortOrder}
        onSort={context.onSort}
      />
    ),
  },
  {
    accessorKey: "activePlayers",
    header: () => (
      <DataTableColumnHeader
        title="Players"
        field="activePlayers"
        sortField={context.sortField}
        sortOrder={context.sortOrder}
        onSort={context.onSort}
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
    header: () => (
      <DataTableColumnHeader
        title="Current Map"
        field="activeMap"
        sortField={context.sortField}
        sortOrder={context.sortOrder}
        onSort={context.onSort}
      />
    ),
    cell: ({ row }) => {
      const server = row.original
      return <span>{server.activeMap || "-"}</span>
    },
  },
  {
    accessorKey: "lastEvent",
    header: () => (
      <DataTableColumnHeader
        title="Last Event"
        field="lastEvent"
        sortField={context.sortField}
        sortOrder={context.sortOrder}
        onSort={context.onSort}
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
    header: () => (
      <div className="flex items-center justify-end pr-3 pl-1">
        <Button
          variant="ghost"
          className="size-8 p-0 group"
          onClick={context.onRefresh}
          disabled={context.isPending}
        >
          <RotateCw
            className={cn(
              "size-4",
              context.isPending ? "animate-spin" : "",
              "text-zinc-500 group-hover:text-zinc-100 transition-colors duration-200",
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
                <MoreHorizontal className="size-4" />
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
            <DropdownMenuItem>Edit server</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
