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
} from "@repo/ui"
import { Game } from "@repo/database/client"
import { ColumnDef, HeaderContext } from "@tanstack/react-table"
import { FilterConfig } from "@/features/common/types/data-table"
import { DataTableColumnHeader } from "@/features/common/components/data-table-col-header"
import { IconDots, IconRefresh } from "@repo/ui"

interface ExtendedHeaderContext<TData, TValue> extends HeaderContext<TData, TValue> {
  sortField?: string
  sortOrder?: "asc" | "desc"
  onSort?: (field: string) => void
  onRefresh?: () => void
  isPending?: boolean
}

export type GameListItem = Pick<Game, "code" | "name" | "hidden" | "realgame"> & {
  __typename?: string
}

export const gameFilterConfig: FilterConfig = {
  columnId: "search",
  placeholder: "Filter games...",
  label: "Game Search",
}

export const gameColumns = (): ColumnDef<GameListItem>[] => [
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
    accessorKey: "code",
    header: (props: ExtendedHeaderContext<GameListItem, unknown>) => (
      <DataTableColumnHeader
        title="Code"
        field="code"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const game = row.original
      return <span className="pl-2 font-mono font-medium">{game.code}</span>
    },
  },
  {
    accessorKey: "name",
    header: (props: ExtendedHeaderContext<GameListItem, unknown>) => (
      <DataTableColumnHeader
        title="Name"
        field="name"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const game = row.original
      return <span className="font-medium">{game.name}</span>
    },
  },
  {
    accessorKey: "realgame",
    header: (props: ExtendedHeaderContext<GameListItem, unknown>) => (
      <DataTableColumnHeader
        title="Engine"
        field="realgame"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const game = row.original
      return <span className="font-mono">{game.realgame}</span>
    },
  },
  {
    accessorKey: "hidden",
    header: (props: ExtendedHeaderContext<GameListItem, unknown>) => (
      <DataTableColumnHeader
        title="Status"
        field="hidden"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const game = row.original
      const isHidden = game.hidden === "1"
      return (
        <Badge
          variant="outline"
          colorScheme={isHidden ? "light" : "green"}
          className={cn(isHidden && "dark:text-zinc-700 text-zinc-500")}
        >
          {isHidden ? "Hidden" : "Visible"}
        </Badge>
      )
    },
  },
  {
    id: "actions",
    header: (props: ExtendedHeaderContext<GameListItem, unknown>) => (
      <div className="flex items-center justify-end pr-3 pl-1">
        <Button
          variant="ghost"
          className="size-8 p-0 group"
          onClick={props.onRefresh}
          disabled={props.isPending}
        >
          <IconRefresh
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
      const game = row.original

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
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(game.code)}>
              Copy game code
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>View game</DropdownMenuItem>
            <DropdownMenuItem>Edit settings</DropdownMenuItem>
            <DropdownMenuItem>{game.hidden === "1" ? "Show game" : "Hide game"}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
