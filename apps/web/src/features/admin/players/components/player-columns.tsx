import { DataTableColumnHeader } from "@/features/common/components/data-table-col-header"
import { useDataTableContext } from "@/features/common/components/data-table-context"
import { DataTableConfig } from "@/features/common/types/data-table"
import { formatDate } from "@/lib/datetime-util"
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
  IconDots,
  IconRefresh,
} from "@repo/ui"
import { ColumnDef } from "@tanstack/react-table"

export type PlayerListItem = {
  playerId: string
  lastName: string
  email?: string | null
  skill: number
  kills: number
  deaths: number
  lastEvent?: string | Date | null
  lastSkillChange?: string | Date | null
  __typename?: string
}

export const playerTableConfig: DataTableConfig = {
  defaultSortField: "lastName",
  defaultSortOrder: "asc",
  defaultPageSize: 10,
  searchFields: ["lastName", "email"],
  filterPlaceholder: "Filter players...",
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

export const playerColumns = (): ColumnDef<PlayerListItem>[] => [
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
    accessorKey: "playerId",
    header: () => <DataTableColumnHeader title="ID" field="playerId" />,
    cell: ({ row }) => <span className="pl-2">{row.original.playerId}</span>,
  },
  {
    accessorKey: "lastName",
    header: () => <DataTableColumnHeader title="Name" field="lastName" />,
  },
  {
    accessorKey: "email",
    header: () => <DataTableColumnHeader title="Email" field="email" />,
  },
  {
    accessorKey: "skill",
    header: () => <DataTableColumnHeader title="Skill" field="skill" />,
  },
  {
    accessorKey: "kills",
    header: () => <DataTableColumnHeader title="Kills" field="kills" />,
  },
  {
    accessorKey: "deaths",
    header: () => <DataTableColumnHeader title="Deaths" field="deaths" />,
  },
  {
    accessorKey: "lastEvent",
    header: () => <DataTableColumnHeader title="Last Event" field="lastEvent" />,
    cell: ({ row }) => {
      const player = row.original
      if (!player.lastEvent) return <span>-</span>
      return <span>{formatDate(player.lastEvent)}</span>
    },
  },
  {
    accessorKey: "lastSkillChange",
    header: () => <DataTableColumnHeader title="Last Skill Change" field="lastSkillChange" />,
    cell: ({ row }) => {
      const player = row.original
      if (!player.lastSkillChange) return <span>-</span>
      return <span>{formatDate(player.lastSkillChange)}</span>
    },
  },
  {
    id: "actions",
    header: () => <ActionsHeader />,
    cell: ({ row }) => {
      const player = row.original
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
