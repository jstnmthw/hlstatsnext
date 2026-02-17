import { DataTableColumnHeader } from "@/features/common/components/data-table-col-header"
import { useDataTableContext } from "@/features/common/components/data-table-context"
import { DataTableConfig } from "@/features/common/types/data-table"
import { Game } from "@repo/db/client"
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

export type GameListItem = Pick<Game, "code" | "name" | "hidden" | "realgame"> & {
  __typename?: string
}

export const gameTableConfig: DataTableConfig = {
  defaultSortField: "name",
  defaultSortOrder: "asc",
  defaultPageSize: 10,
  searchFields: ["name", "code"],
  filterPlaceholder: "Filter games...",
  filters: [
    {
      id: "hidden",
      title: "Visibility",
      options: [
        { label: "Visible", value: "0" },
        { label: "Hidden", value: "1" },
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

export const gameColumns = (): ColumnDef<GameListItem>[] => [
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
    accessorKey: "code",
    header: () => <DataTableColumnHeader title="Code" field="code" />,
    cell: ({ row }) => <span className="pl-2 font-mono font-medium">{row.original.code}</span>,
  },
  {
    accessorKey: "name",
    header: () => <DataTableColumnHeader title="Name" field="name" />,
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: "realgame",
    header: () => <DataTableColumnHeader title="Engine" field="realgame" />,
    cell: ({ row }) => <span>{row.original.realgame}</span>,
  },
  {
    accessorKey: "hidden",
    header: () => <DataTableColumnHeader title="Status" field="hidden" />,
    cell: ({ row }) => {
      const game = row.original
      const isHidden = game.hidden === "1"
      return (
        <Badge
          variant="outline"
          colorScheme={isHidden ? "light" : "green"}
          className={cn(isHidden && "text-zinc-500 dark:text-zinc-700")}
        >
          {isHidden ? "Hidden" : "Visible"}
        </Badge>
      )
    },
  },
  {
    id: "actions",
    header: () => <ActionsHeader />,
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
