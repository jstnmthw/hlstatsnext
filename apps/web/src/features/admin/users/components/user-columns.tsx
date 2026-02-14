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
import { ColumnDef, HeaderContext } from "@tanstack/react-table"
import { formatDate } from "@/lib/datetime-util"
import { FilterConfig } from "@/features/common/types/data-table"
import { DataTableColumnHeader } from "@/features/common/components/data-table-col-header"
import { MoreHorizontal, RotateCw } from "lucide-react"

interface ExtendedHeaderContext<TData, TValue> extends HeaderContext<TData, TValue> {
  sortField?: string
  sortOrder?: "asc" | "desc"
  onSort?: (field: string) => void
  onRefresh?: () => void
  isPending?: boolean
}

export type UserListItem = {
  username: string
  acclevel: number
  playerId: number
  player: {
    lastName: string
    email?: string | null
    lastEvent?: string | Date | null
    __typename?: string
  }
  __typename?: string
}

export const userFilterConfig: FilterConfig = {
  columnId: "search",
  placeholder: "Filter users...",
  label: "User Search",
}

export const userColumns = (): ColumnDef<UserListItem>[] => [
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
    accessorKey: "username",
    header: (props: ExtendedHeaderContext<UserListItem, unknown>) => (
      <DataTableColumnHeader
        title="Username"
        field="username"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const user = row.original
      return <span className="pl-2 font-medium">{user.username}</span>
    },
  },
  {
    accessorKey: "acclevel",
    header: (props: ExtendedHeaderContext<UserListItem, unknown>) => (
      <DataTableColumnHeader
        title="Access Level"
        field="acclevel"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const user = row.original
      const getLevelBadge = (level: number) => {
        if (level >= 100)
          return <span className="px-2 py-1 text-xs bg-red-900 text-red-100 rounded">Admin</span>
        if (level >= 50)
          return (
            <span className="px-2 py-1 text-xs bg-orange-900 text-orange-100 rounded">
              Moderator
            </span>
          )
        if (level >= 10)
          return <span className="px-2 py-1 text-xs bg-blue-900 text-blue-100 rounded">User</span>
        return <span className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded">Guest</span>
      }
      return getLevelBadge(user.acclevel)
    },
  },
  {
    accessorKey: "playerId",
    header: (props: ExtendedHeaderContext<UserListItem, unknown>) => (
      <DataTableColumnHeader
        title="Player ID"
        field="playerId"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const user = row.original
      return <span>{user.playerId}</span>
    },
  },
  {
    accessorKey: "player.lastName",
    header: (props: ExtendedHeaderContext<UserListItem, unknown>) => (
      <DataTableColumnHeader
        title="Player Name"
        field="player.lastName"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const user = row.original
      return <span>{user.player?.lastName || "-"}</span>
    },
  },
  {
    accessorKey: "player.email",
    header: (props: ExtendedHeaderContext<UserListItem, unknown>) => (
      <DataTableColumnHeader
        title="Email"
        field="player.email"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const user = row.original
      return <span>{user.player?.email || "-"}</span>
    },
  },
  {
    accessorKey: "player.lastEvent",
    header: (props: ExtendedHeaderContext<UserListItem, unknown>) => (
      <DataTableColumnHeader
        title="Last Event"
        field="player.lastEvent"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const user = row.original
      if (!user.player?.lastEvent) return <span>-</span>
      return <span>{formatDate(user.player.lastEvent)}</span>
    },
  },
  {
    id: "actions",
    header: (props: ExtendedHeaderContext<UserListItem, unknown>) => (
      <div className="flex items-center justify-end pr-3 pl-1">
        <Button
          variant="ghost"
          className="size-8 p-0 group"
          onClick={props.onRefresh}
          disabled={props.isPending}
        >
          <RotateCw
            className={cn(
              "size-4",
              props.isPending ? "animate-spin" : "",
              "text-zinc-500 group-hover:text-zinc-100 transition-colors duration-200",
            )}
          />
        </Button>
      </div>
    ),
    cell: ({ row }) => {
      const user = row.original

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
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(user.username)}>
              Copy username
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>View user</DropdownMenuItem>
            <DropdownMenuItem>Edit permissions</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
