"use client"

import { DataTableColumnHeader } from "@/features/common/components/data-table-col-header"
import { Button, cn, IconPlayerPlay } from "@repo/ui"
import { ColumnDef } from "@tanstack/react-table"
import Link from "next/link"
import { PublicServerItem } from "./server-config"

export { recentServerTableConfig, serverPageTableConfig } from "./server-config"
export type { PublicServerItem } from "./server-config"

const isOnline = (lastEvent: string | Date | null | undefined): boolean => {
  if (!lastEvent) return false
  return new Date(lastEvent).getTime() > Date.now() - 5 * 60_000
}

function StatusDot({ lastEvent }: { lastEvent: string | Date | null | undefined }) {
  const online = isOnline(lastEvent)
  return (
    <div className="flex items-center justify-center">
      <div className={cn("size-2 rounded-full", online ? "bg-primary-bright" : "bg-neutral-800")} />
    </div>
  )
}

function PlayButton({ server }: { server: PublicServerItem }) {
  const online = isOnline(server.lastEvent)
  return (
    <div className="flex items-center justify-end">
      <Button
        variant="outline"
        colorScheme="light"
        className="cursor-pointer rounded text-xs"
        size="icon-sm"
        disabled={!online}
        asChild={online}
      >
        {online ? (
          <a href={`steam://connect/${server.address}:${server.port}`}>
            <IconPlayerPlay className="size-3" fill="currentColor" />
          </a>
        ) : (
          <span>
            <IconPlayerPlay className="size-3" fill="currentColor" />
          </span>
        )}
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Homepage — compact columns (no toolbar, no pagination)
// ---------------------------------------------------------------------------

export const recentServerColumns: ColumnDef<PublicServerItem>[] = [
  {
    id: "status",
    accessorKey: "lastEvent",
    header: () => <span className="sr-only">Status</span>,
    cell: ({ row }) => <StatusDot lastEvent={row.original.lastEvent} />,
    enableSorting: false,
  },
  {
    accessorKey: "name",
    header: "Server",
    cell: ({ row }) => (
      <div>
        <Link
          href={`/servers/${row.original.serverId}`}
          className="font-medium hover:text-primary-bright hover:underline"
        >
          {row.original.name}
        </Link>
        <div className="font-mono text-sm text-muted-foreground">
          {row.original.address}:{row.original.port}
        </div>
      </div>
    ),
  },
  {
    id: "players",
    accessorKey: "activePlayers",
    header: "Players",
    cell: ({ row }) => (
      <span className="text-muted-foreground tabular-nums">
        {row.original.activePlayers}/{row.original.maxPlayers}
      </span>
    ),
  },
  {
    id: "play",
    header: () => <span className="sr-only">Play</span>,
    cell: ({ row }) => <PlayButton server={row.original} />,
    enableSorting: false,
  },
]

// ---------------------------------------------------------------------------
// /servers page — full columns (toolbar, sorting, pagination)
// ---------------------------------------------------------------------------

export const serverPageColumns: ColumnDef<PublicServerItem>[] = [
  {
    id: "status",
    accessorKey: "lastEvent",
    header: () => <span className="sr-only">Status</span>,
    cell: ({ row }) => <StatusDot lastEvent={row.original.lastEvent} />,
    enableSorting: false,
  },
  {
    accessorKey: "name",
    header: () => <DataTableColumnHeader title="Server Name" field="name" />,
    cell: ({ row }) => (
      <Link
        href={`/servers/${row.original.serverId}`}
        className="font-medium hover:text-primary-bright hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    id: "address",
    header: "IP:Port",
    cell: ({ row }) => (
      <span className="font-mono text-muted-foreground">
        {row.original.address}:{row.original.port}
      </span>
    ),
  },
  {
    id: "players",
    accessorKey: "activePlayers",
    header: () => <DataTableColumnHeader title="Players" field="activePlayers" />,
    cell: ({ row }) => (
      <span className="text-muted-foreground tabular-nums">
        {row.original.activePlayers}/{row.original.maxPlayers}
      </span>
    ),
  },
  {
    id: "play",
    header: () => <span className="sr-only">Play</span>,
    cell: ({ row }) => <PlayButton server={row.original} />,
    enableSorting: false,
  },
]
