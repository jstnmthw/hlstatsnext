import { ColumnDef } from "@tanstack/react-table"
import { Server } from "@repo/database/client"

export type ServerListItem = Pick<
  Server,
  "name" | "address" | "port" | "activePlayers" | "maxPlayers" | "activeMap"
> & {
  serverId: string // GraphQL returns this as string
  lastEvent?: string | Date // GraphQL field is optional, could be string or Date
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
    cell: ({ row }) => {
      const lastEvent = row.getValue("lastEvent") as string | Date | undefined
      if (!lastEvent) {
        return <div className="text-muted-foreground">Never</div>
      }
      return (
        <div>
          {new Date(lastEvent).toLocaleString("en-US", {
            month: "numeric",
            day: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })}
        </div>
      )
    },
  },
]
