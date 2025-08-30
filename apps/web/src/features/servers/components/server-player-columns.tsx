import Link from "next/link"
import Image from "next/image"
import {
  Badge,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui"
import { ColumnDef, HeaderContext } from "@tanstack/react-table"
import { formatDate, formatDuration } from "@/lib/datetime-util"
import { FilterConfig } from "@/features/common/types/data-table"
import { DataTableColumnHeader } from "@/features/common/components/data-table-col-header"
import { MoreHorizontal } from "lucide-react"

interface ExtendedHeaderContext<TData, TValue> extends HeaderContext<TData, TValue> {
  sortField?: string
  sortOrder?: "asc" | "desc"
  onSort?: (field: string) => void
  onRefresh?: () => void
  isPending?: boolean
}

export interface PlayerServerStatsItem {
  playerId: number
  lastName: string
  skill: number
  kills: number
  deaths: number
  suicides: number
  headshots: number
  connectionTime: number
  lastEvent: string | Date | null
  lastSkillChange: string | Date | null
  activity: number
  country: string
  flag: string | null
  kdRatio: number
  headshotRatio: number
  isOnline: boolean
  sessionDuration?: number
  totalSessions: number
  favoriteServer: boolean
  rank: string
  accuracyPercentage: number
}

export const serverPlayerFilterConfig: FilterConfig = {
  columnId: "search",
  placeholder: "Search players...",
  label: "Player Search",
}

export const serverPlayerColumns = (serverId: number): ColumnDef<PlayerServerStatsItem>[] => [
  {
    accessorKey: "lastName",
    header: (props: ExtendedHeaderContext<PlayerServerStatsItem, unknown>) => (
      <DataTableColumnHeader
        title="Player"
        field="lastName"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const player = row.original
      return (
        <div className="flex items-center space-x-2">
          {player.flag && (
            <Image
              src={`/flags/${player.flag.toLowerCase()}.png`}
              alt={player.country}
              width={16}
              height={12}
              className="w-4 h-3 rounded-sm"
              title={player.country}
            />
          )}
          <div className="flex flex-col">
            <Link
              href={`/players/${player.playerId}`}
              className="font-medium hover:underline text-blue-400 hover:text-blue-300"
            >
              {player.lastName}
            </Link>
            {player.isOnline && (
              <Badge variant="outline" colorScheme="green" className="w-fit text-xs mt-1">
                Online
              </Badge>
            )}
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "rank",
    header: (props: ExtendedHeaderContext<PlayerServerStatsItem, unknown>) => (
      <DataTableColumnHeader
        title="Rank"
        field="skill"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const player = row.original
      const rankColors: Record<string, string> = {
        Elite: "text-purple-400",
        Expert: "text-red-400",
        Advanced: "text-orange-400",
        Intermediate: "text-yellow-400",
        Novice: "text-green-400",
        Beginner: "text-gray-400",
      }
      return (
        <span className={cn("font-medium", rankColors[player.rank] || "text-gray-400")}>
          {player.rank}
        </span>
      )
    },
  },
  {
    accessorKey: "skill",
    header: (props: ExtendedHeaderContext<PlayerServerStatsItem, unknown>) => (
      <DataTableColumnHeader
        title="Skill"
        field="skill"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const player = row.original
      return <span className="font-mono text-sm">{player.skill.toLocaleString()}</span>
    },
  },
  {
    accessorKey: "kills",
    header: (props: ExtendedHeaderContext<PlayerServerStatsItem, unknown>) => (
      <DataTableColumnHeader
        title="Kills"
        field="kills"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const player = row.original
      return <span className="font-mono text-sm">{player.kills.toLocaleString()}</span>
    },
  },
  {
    accessorKey: "deaths",
    header: (props: ExtendedHeaderContext<PlayerServerStatsItem, unknown>) => (
      <DataTableColumnHeader
        title="Deaths"
        field="deaths"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const player = row.original
      return <span className="font-mono text-sm">{player.deaths.toLocaleString()}</span>
    },
  },
  {
    accessorKey: "kdRatio",
    header: (props: ExtendedHeaderContext<PlayerServerStatsItem, unknown>) => (
      <DataTableColumnHeader
        title="K/D"
        field="kdRatio"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const player = row.original
      const kdClass =
        player.kdRatio >= 2
          ? "text-green-400"
          : player.kdRatio >= 1
            ? "text-yellow-400"
            : "text-red-400"
      return <span className={cn("font-mono text-sm", kdClass)}>{player.kdRatio.toFixed(2)}</span>
    },
  },
  {
    accessorKey: "headshotRatio",
    header: (props: ExtendedHeaderContext<PlayerServerStatsItem, unknown>) => (
      <DataTableColumnHeader
        title="HS%"
        field="headshotRatio"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const player = row.original
      return <span className="font-mono text-sm">{player.headshotRatio.toFixed(1)}%</span>
    },
  },
  {
    accessorKey: "connectionTime",
    header: (props: ExtendedHeaderContext<PlayerServerStatsItem, unknown>) => (
      <DataTableColumnHeader
        title="Time Played"
        field="connectionTime"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const player = row.original
      return (
        <div className="flex flex-col">
          <span className="text-sm">{formatDuration(player.connectionTime)}</span>
          {player.isOnline && player.sessionDuration && (
            <span className="text-xs text-muted-foreground">
              +{formatDuration(player.sessionDuration)} this session
            </span>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "lastEvent",
    header: (props: ExtendedHeaderContext<PlayerServerStatsItem, unknown>) => (
      <DataTableColumnHeader
        title="Last Seen"
        field="lastEvent"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const player = row.original
      if (!player.lastEvent) return <span>-</span>

      const lastEventDate = new Date(player.lastEvent)
      const isRecent = Date.now() - lastEventDate.getTime() < 24 * 60 * 60 * 1000 // within 24 hours

      return (
        <div className="flex flex-col">
          <span className={cn("text-sm", isRecent && "text-green-400")}>
            {formatDate(player.lastEvent)}
          </span>
          {player.favoriteServer && (
            <Badge variant="outline" colorScheme="blue" className="w-fit text-xs mt-1">
              Regular
            </Badge>
          )}
        </div>
      )
    },
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => {
      const player = row.original
      return (
        <div className="flex flex-col space-y-1">
          <Badge
            variant="outline"
            colorScheme={player.isOnline ? "green" : "light"}
            className={cn(player.isOnline && "text-green-400 border-green-600")}
          >
            {player.isOnline ? "Online" : "Offline"}
          </Badge>
          {player.totalSessions > 0 && (
            <span className="text-xs text-muted-foreground">
              {player.totalSessions} session{player.totalSessions !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const player = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="size-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href={`/players/${player.playerId}`}>View player profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/players/${player.playerId}/servers/${serverId}`}>
                View server history
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(player.lastName)}>
              Copy player name
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(player.playerId.toString())}
            >
              Copy player ID
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
