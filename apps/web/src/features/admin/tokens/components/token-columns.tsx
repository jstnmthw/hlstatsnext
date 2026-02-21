import { DataTableColumnHeader } from "@/features/common/components/data-table-col-header"
import { useDataTableContext } from "@/features/common/components/data-table-context"
import { DataTableConfig } from "@/features/common/types/data-table"
import { formatDate, formatHumanFriendlyDate } from "@/lib/datetime-util"
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

export interface TokenListItem {
  id: number
  tokenPrefix: string
  name: string
  game: string
  createdAt: string | Date
  expiresAt?: string | Date | null
  revokedAt?: string | Date | null
  lastUsedAt?: string | Date | null
  createdBy: string
  serverCount: number
  status: string
  hasRconPassword: boolean
  __typename?: string
}

export const tokenTableConfig: DataTableConfig = {
  defaultSortField: "createdAt",
  defaultSortOrder: "desc",
  defaultPageSize: 10,
  searchFields: ["name", "tokenPrefix", "game"],
  filterPlaceholder: "Filter tokens...",
  filters: [
    {
      id: "status",
      title: "Status",
      options: [
        { label: "Active", value: "active" },
        { label: "Revoked", value: "revoked" },
        { label: "Expired", value: "expired" },
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

function getStatusBadge(status: string) {
  switch (status) {
    case "active":
      return (
        <Badge variant="outline" colorScheme="green">
          Active
        </Badge>
      )
    case "revoked":
      return (
        <Badge variant="outline" colorScheme="red">
          Revoked
        </Badge>
      )
    case "expired":
      return (
        <Badge variant="outline" colorScheme="yellow">
          Expired
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" colorScheme="light">
          {status}
        </Badge>
      )
  }
}

export const tokenColumns = (): ColumnDef<TokenListItem>[] => [
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
    accessorKey: "tokenPrefix",
    header: () => <DataTableColumnHeader title="Token Prefix" field="tokenPrefix" />,
    cell: ({ row }) => (
      <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs">
        {row.original.tokenPrefix}...
      </code>
    ),
  },
  {
    accessorKey: "name",
    header: () => <DataTableColumnHeader title="Name" field="name" />,
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: "game",
    header: () => <DataTableColumnHeader title="Game" field="game" />,
    cell: ({ row }) => (
      <Badge variant="outline" colorScheme="blue">
        {row.original.game}
      </Badge>
    ),
  },
  {
    accessorKey: "status",
    header: () => <DataTableColumnHeader title="Status" field="status" />,
    cell: ({ row }) => getStatusBadge(row.original.status),
  },
  {
    accessorKey: "serverCount",
    header: () => <DataTableColumnHeader title="Servers" field="serverCount" />,
    cell: ({ row }) => <span>{row.original.serverCount}</span>,
  },
  {
    accessorKey: "hasRconPassword",
    header: () => <DataTableColumnHeader title="RCON" field="hasRconPassword" />,
    cell: ({ row }) => (
      <Badge variant="outline" colorScheme={row.original.hasRconPassword ? "green" : "light"}>
        {row.original.hasRconPassword ? "Yes" : "No"}
      </Badge>
    ),
  },
  {
    accessorKey: "lastUsedAt",
    header: () => <DataTableColumnHeader title="Last Used" field="lastUsedAt" />,
    cell: ({ row }) => {
      const token = row.original
      if (!token.lastUsedAt) return <span className="text-zinc-500">Never</span>
      return <span>{formatHumanFriendlyDate(token.lastUsedAt)}</span>
    },
  },
  {
    accessorKey: "createdAt",
    header: () => <DataTableColumnHeader title="Created" field="createdAt" />,
    cell: ({ row }) => <span>{formatDate(row.original.createdAt)}</span>,
  },
  {
    id: "actions",
    header: () => <ActionsHeader />,
    cell: ({ row }) => {
      const token = row.original
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
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(token.tokenPrefix)}>
              Copy token prefix
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="text-zinc-500">
              Status: {token.status}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
