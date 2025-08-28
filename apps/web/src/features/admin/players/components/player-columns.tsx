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
import { Player } from "@repo/database/client"
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

export type PlayerListItem = Pick<
  Player,
  "playerId" | "lastName" | "email" | "skill" | "kills" | "deaths" | "lastEvent" | "lastSkillChange"
> & {
  playerId: string // GraphQL returns this as string
  __typename?: string // GraphQL metadata field
}

export const columns: ColumnDef<PlayerListItem>[] = [
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
    accessorKey: "playerId",
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="ID" />
    },
    cell: ({ row }) => {
      const player = row.original
      return <span className="pl-2">{player.playerId}</span>
    },
  },
  {
    accessorKey: "lastName",
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Name" />
    },
  },
  {
    accessorKey: "email",
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Email" />
    },
  },
  {
    accessorKey: "skill",
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Skill" />
    },
  },
  {
    accessorKey: "kills",
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Kills" />
    },
  },
  {
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Deaths" />
    },
    accessorKey: "deaths",
  },
  {
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Last Event" />
    },
    accessorKey: "lastEvent",
    cell: ({ row }) => {
      const player = row.original
      if (!player.lastEvent) return <span>-</span>
      return <span>{formatDate(player.lastEvent)}</span>
    },
  },
  {
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Last Skill Change" />
    },
    accessorKey: "lastSkillChange",
    cell: ({ row }) => {
      const player = row.original
      if (!player.lastSkillChange) return <span>-</span>
      return <span>{formatDate(player.lastSkillChange)}</span>
    },
  },
  {
    id: "actions",
    header: () => {
      return (
        <div className="flex items-center justify-end pr-3 pl-1">
          <Button variant="ghost" className="size-8 p-0">
            <RotateCw className="size-4" />
          </Button>
        </div>
      )
    },
    cell: ({ row }) => {
      const player = row.original

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
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(player.playerId)}>
              Copy player ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>View player</DropdownMenuItem>
            <DropdownMenuItem>View player details</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

export const playerFilterConfig: FilterConfig = {
  columnId: "search",
  placeholder: "Filter players...",
  label: "Player Search",
}

export const playerColumns = (): ColumnDef<PlayerListItem>[] => [
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
    accessorKey: "playerId",
    header: (props: ExtendedHeaderContext<PlayerListItem, unknown>) => (
      <DataTableColumnHeader
        title="ID"
        field="playerId"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const player = row.original
      return <span className="pl-2">{player.playerId}</span>
    },
  },
  {
    accessorKey: "lastName",
    header: (props: ExtendedHeaderContext<PlayerListItem, unknown>) => (
      <DataTableColumnHeader
        title="Name"
        field="lastName"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
  },
  {
    accessorKey: "email",
    header: (props: ExtendedHeaderContext<PlayerListItem, unknown>) => (
      <DataTableColumnHeader
        title="Email"
        field="email"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
  },
  {
    accessorKey: "skill",
    header: (props: ExtendedHeaderContext<PlayerListItem, unknown>) => (
      <DataTableColumnHeader
        title="Skill"
        field="skill"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
  },
  {
    accessorKey: "kills",
    header: (props: ExtendedHeaderContext<PlayerListItem, unknown>) => (
      <DataTableColumnHeader
        title="Kills"
        field="kills"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
  },
  {
    accessorKey: "deaths",
    header: (props: ExtendedHeaderContext<PlayerListItem, unknown>) => (
      <DataTableColumnHeader
        title="Deaths"
        field="deaths"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
  },
  {
    accessorKey: "lastEvent",
    header: (props: ExtendedHeaderContext<PlayerListItem, unknown>) => (
      <DataTableColumnHeader
        title="Last Event"
        field="lastEvent"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const player = row.original
      if (!player.lastEvent) return <span>-</span>
      return <span>{formatDate(player.lastEvent)}</span>
    },
  },
  {
    accessorKey: "lastSkillChange",
    header: (props: ExtendedHeaderContext<PlayerListItem, unknown>) => (
      <DataTableColumnHeader
        title="Last Skill Change"
        field="lastSkillChange"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const player = row.original
      if (!player.lastSkillChange) return <span>-</span>
      return <span>{formatDate(player.lastSkillChange)}</span>
    },
  },
  {
    id: "actions",
    header: (props: ExtendedHeaderContext<PlayerListItem, unknown>) => (
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
      const player = row.original

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
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(player.playerId)}>
              Copy player ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>View player</DropdownMenuItem>
            <DropdownMenuItem>View player details</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
