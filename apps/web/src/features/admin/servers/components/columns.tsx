import { ColumnDef } from "@tanstack/react-table"
import { Server } from "@repo/database/client"

type ServerListItem = Pick<
  Server,
  "name" | "address" | "port" | "activePlayers" | "maxPlayers" | "activeMap"
> & {
  serverId: string // GraphQL returns this as string
  lastEvent?: Date // GraphQL field is optional
  __typename?: string // GraphQL metadata field
}

export const columns: ColumnDef<ServerListItem>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "serverId",
    header: "Server ID",
  },
  {
    accessorKey: "address",
    header: "Address",
  },
  {
    accessorKey: "port",
    header: "Port",
  },
  {
    accessorKey: "activePlayers",
    header: "Active Players",
  },
  {
    accessorKey: "maxPlayers",
    header: "Max Players",
  },
  {
    accessorKey: "activeMap",
    header: "Active Map",
  },
  {
    accessorKey: "lastEvent",
    header: "Last Event",
  },
]
