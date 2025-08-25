import { Player } from "@repo/database/client"
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui"
import { MoreHorizontal } from "lucide-react"
import { ColumnDef } from "@tanstack/react-table"
import { formatDate } from "@/lib/datetime-util"

export type PlayerListItem = Pick<
  Player,
  "playerId" | "lastName" | "email" | "skill" | "kills" | "deaths" | "lastEvent" | "lastSkillChange"
> & {
  playerId: string // GraphQL returns this as string
  __typename?: string // GraphQL metadata field
}

export const columns: ColumnDef<PlayerListItem>[] = [
  {
    header: "Player ID",
    accessorKey: "playerId",
  },
  {
    header: "Name",
    accessorKey: "lastName",
  },
  {
    header: "Email",
    accessorKey: "email",
  },
  {
    header: "Skill",
    accessorKey: "skill",
  },
  {
    header: "Kills",
    accessorKey: "kills",
  },
  {
    header: "Deaths",
    accessorKey: "deaths",
  },
  {
    header: "Last Event",
    accessorKey: "lastEvent",
    cell: ({ row }) => {
      const player = row.original
      if (!player.lastEvent) return <span>-</span>
      return <span>{formatDate(player.lastEvent)}</span>
    },
  },
  {
    header: "Last Skill Change",
    accessorKey: "lastSkillChange",
    cell: ({ row }) => {
      const player = row.original
      if (!player.lastSkillChange) return <span>-</span>
      return <span>{formatDate(player.lastSkillChange)}</span>
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const player = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="size-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
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
