import { DataTableColumnHeader } from "@/features/common/components/data-table-col-header"
import { useDataTableContext } from "@/features/common/components/data-table-context"
import { DataTableConfig } from "@/features/common/types/data-table"
import { formatDate } from "@/lib/datetime-util"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Checkbox,
  cn,
  IconBan,
  IconCheck,
  IconCircle,
  IconCircleCheck,
  IconMailOff,
  IconRefresh,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui"
import { ColumnDef } from "@tanstack/react-table"
import { UserRowActions } from "./user-row-actions"

export type UserListItem = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  role?: string | null
  banned?: boolean | null
  banReason?: string | null
  banExpires?: string | Date | null
  image?: string | null
  createdAt: string | Date | null
  updatedAt: string | Date | null
  __typename?: string
}

export const userTableConfig: DataTableConfig = {
  defaultSortField: "name",
  defaultSortOrder: "asc",
  defaultPageSize: 10,
  searchFields: ["name", "email"],
  filterPlaceholder: "Filter users...",
  filters: [
    {
      id: "role",
      title: "Role",
      options: [
        { label: "Admin", value: "admin" },
        { label: "User", value: "user" },
      ],
    },
    {
      id: "status",
      title: "Status",
      options: [
        { label: "Active", value: "active", icon: IconCheck },
        { label: "Banned", value: "banned", icon: IconBan },
        { label: "Unverified", value: "unverified", icon: IconCircle },
      ],
    },
  ],
  frozenColumnsLeft: ["select"],
  frozenColumnsRight: ["actions"],
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

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function StatusBadge({ user }: { user: UserListItem }) {
  if (user.banned) {
    const tooltipContent = [
      user.banReason && `Reason: ${user.banReason}`,
      user.banExpires && `Expires: ${formatDate(user.banExpires)}`,
    ]
      .filter(Boolean)
      .join("\n")

    if (tooltipContent) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" colorScheme="red" className="gap-1">
                <IconBan className="size-3" />
                Banned
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="whitespace-pre-line">{tooltipContent}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    return (
      <Badge variant="destructive" className="gap-1">
        <IconBan className="size-3" />
        Banned
      </Badge>
    )
  }

  if (!user.emailVerified) {
    return (
      <Badge variant="secondary" className="gap-1">
        <IconMailOff className="size-3" />
        Unverified
      </Badge>
    )
  }

  return (
    <Badge variant="outline" colorScheme="green" className="gap-1">
      <IconCircleCheck className="size-3" />
      Active
    </Badge>
  )
}

export const userColumns = (): ColumnDef<UserListItem>[] => [
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
    accessorKey: "name",
    header: () => <DataTableColumnHeader title="Name" field="name" />,
    cell: ({ row }) => {
      const user = row.original
      return (
        <div className="flex items-center gap-3 pl-2">
          <Avatar className="size-8">
            {user.image && <AvatarImage src={user.image} alt={user.name} />}
            <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium">{user.name}</span>
            <span className="text-xs text-muted-foreground">{user.email}</span>
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "role",
    header: () => <DataTableColumnHeader title="Role" field="role" />,
    cell: () => {
      return (
        <Badge variant="outline" className="font-light opacity-60">
          User
        </Badge>
      )
    },
  },
  {
    id: "status",
    accessorKey: "banned",
    header: () => <DataTableColumnHeader title="Status" field="banned" />,
    cell: ({ row }) => <StatusBadge user={row.original} />,
  },
  {
    accessorKey: "createdAt",
    header: () => <DataTableColumnHeader title="Created" field="createdAt" />,
    cell: ({ row }) => {
      const user = row.original
      if (!user.createdAt) return <span>-</span>
      return <span>{formatDate(user.createdAt)}</span>
    },
  },
  {
    id: "actions",
    header: () => <ActionsHeader />,
    cell: ({ row }) => <UserRowActions user={row.original} />,
  },
]
