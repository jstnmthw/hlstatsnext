import { DataTableActionsHeader } from "@/features/common/components/data-table-actions-header"
import { DataTableColumnHeader } from "@/features/common/components/data-table-col-header"
import { createSelectColumn } from "@/features/common/components/data-table-select-column"
import { DataTableConfig } from "@/features/common/types/data-table"
import { formatDate } from "@/lib/datetime-util"
import {
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

export type PlayerListItem = {
  playerId?: number | null
  lastName?: string | null
  email?: string | null
  skill?: number | null
  kills?: number | null
  deaths?: number | null
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
  frozenColumnsLeft: ["select"],
  frozenColumnsRight: ["actions"],
}

export const playerColumns = (): ColumnDef<PlayerListItem>[] => [
  createSelectColumn<PlayerListItem>(),
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
    header: () => <DataTableActionsHeader />,
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
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(String(player.playerId ?? ""))}
            >
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
