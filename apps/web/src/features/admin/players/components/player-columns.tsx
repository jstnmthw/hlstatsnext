import { Player } from "@repo/database/client"
import { ColumnDef } from "@tanstack/react-table"

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
  },
  {
    header: "Last Skill Change",
    accessorKey: "lastSkillChange",
  },
]
