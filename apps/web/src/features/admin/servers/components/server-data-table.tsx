"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Server } from "@repo/database/client"
import { DataTable } from "@/features/common/components/data-table"

type ServerListItem = Pick<
  Server,
  "name" | "address" | "port" | "activePlayers" | "maxPlayers" | "activeMap"
> & {
  serverId: string // GraphQL returns this as string
  lastEvent?: string | Date // GraphQL field is optional, could be string or Date
  __typename?: string // GraphQL metadata field
}

interface ServerDataTableProps {
  data: ServerListItem[]
}

export function ServerDataTable({ data }: ServerDataTableProps) {
  const columns: ColumnDef<ServerListItem>[] = [
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
      cell: ({ row }) => {
        const activePlayers = row.getValue("activePlayers") as number
        const maxPlayers = row.getValue("maxPlayers") as number
        return (
          <div className="font-medium">
            {activePlayers}/{maxPlayers}
          </div>
        )
      },
    },
    {
      accessorKey: "maxPlayers",
      header: "Max Players",
    },
    {
      accessorKey: "activeMap",
      header: "Active Map",
      cell: ({ row }) => {
        const map = row.getValue("activeMap") as string
        return <div className="font-mono text-sm">{map || "N/A"}</div>
      },
    },
    {
      accessorKey: "lastEvent",
      header: () => <div className="text-right">Last Event</div>,
      cell: ({ row }) => {
        const lastEventValue = row.getValue("lastEvent") as string | Date | undefined
        if (!lastEventValue) {
          return <div className="text-right text-muted-foreground">Never</div>
        }

        // Convert to Date object if it's a string (from GraphQL)
        const lastEvent = lastEventValue instanceof Date ? lastEventValue : new Date(lastEventValue)
        const now = new Date()
        const diffInMinutes = Math.floor((now.getTime() - lastEvent.getTime()) / (1000 * 60))

        let timeAgo: string
        if (diffInMinutes < 1) {
          timeAgo = "Just now"
        } else if (diffInMinutes < 60) {
          timeAgo = `${diffInMinutes}m ago`
        } else if (diffInMinutes < 1440) {
          const hours = Math.floor(diffInMinutes / 60)
          timeAgo = `${hours}h ago`
        } else {
          const days = Math.floor(diffInMinutes / 1440)
          timeAgo = `${days}d ago`
        }

        return (
          <div className="text-right">
            <div className="text-sm">{timeAgo}</div>
            <div className="text-xs text-muted-foreground">{lastEvent.toLocaleString()}</div>
          </div>
        )
      },
    },
  ]

  return <DataTable columns={columns} data={data} />
}
