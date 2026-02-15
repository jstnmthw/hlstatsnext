import {
  Button,
  Checkbox,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui"
import { ColumnDef, HeaderContext } from "@tanstack/react-table"
import { formatDate } from "@/lib/datetime-util"
import { FilterConfig } from "@/features/common/types/data-table"
import { DataTableColumnHeader } from "@/features/common/components/data-table-col-header"
import { IconDots, IconRefresh } from "@repo/ui"

interface ExtendedHeaderContext<TData, TValue> extends HeaderContext<TData, TValue> {
  sortField?: string
  sortOrder?: "asc" | "desc"
  onSort?: (field: string) => void
  onRefresh?: () => void
  isPending?: boolean
}

export type UserListItem = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  role?: string | null
  banned?: boolean | null
  createdAt: string | Date | null
  updatedAt: string | Date | null
  __typename?: string
}

export const userFilterConfig: FilterConfig = {
  columnId: "search",
  placeholder: "Filter users...",
  label: "User Search",
}

export const userColumns = (): ColumnDef<UserListItem>[] => [
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center pr-3 pl-1 max-w-10">
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
      <div className="flex items-center justify-center pr-3 pl-1 max-w-10">
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
    header: (props: ExtendedHeaderContext<UserListItem, unknown>) => (
      <DataTableColumnHeader
        title="Name"
        field="name"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const user = row.original
      return <span className="pl-2 font-medium">{user.name}</span>
    },
  },
  {
    accessorKey: "email",
    header: (props: ExtendedHeaderContext<UserListItem, unknown>) => (
      <DataTableColumnHeader
        title="Email"
        field="email"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const user = row.original
      return <span>{user.email}</span>
    },
  },
  {
    accessorKey: "role",
    header: (props: ExtendedHeaderContext<UserListItem, unknown>) => (
      <DataTableColumnHeader
        title="Role"
        field="role"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const user = row.original
      const getRoleBadge = (role: string | null | undefined) => {
        if (role === "admin")
          return <span className="px-2 py-1 text-xs bg-red-900 text-red-100 rounded">Admin</span>
        return <span className="px-2 py-1 text-xs bg-blue-900 text-blue-100 rounded">User</span>
      }
      return getRoleBadge(user.role)
    },
  },
  {
    accessorKey: "banned",
    header: (props: ExtendedHeaderContext<UserListItem, unknown>) => (
      <DataTableColumnHeader
        title="Status"
        field="banned"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const user = row.original
      if (user.banned) {
        return <span className="px-2 py-1 text-xs bg-red-900 text-red-100 rounded">Banned</span>
      }
      return <span className="px-2 py-1 text-xs bg-green-900 text-green-100 rounded">Active</span>
    },
  },
  {
    accessorKey: "createdAt",
    header: (props: ExtendedHeaderContext<UserListItem, unknown>) => (
      <DataTableColumnHeader
        title="Created"
        field="createdAt"
        sortField={props.sortField}
        sortOrder={props.sortOrder}
        onSort={props.onSort}
      />
    ),
    cell: ({ row }) => {
      const user = row.original
      if (!user.createdAt) return <span>-</span>
      return <span>{formatDate(user.createdAt)}</span>
    },
  },
  {
    id: "actions",
    header: (props: ExtendedHeaderContext<UserListItem, unknown>) => (
      <div className="flex items-center justify-end pr-3 pl-1">
        <Button
          variant="ghost"
          className="size-8 p-0 group"
          onClick={props.onRefresh}
          disabled={props.isPending}
        >
          <IconRefresh
            className={cn(
              "size-4",
              props.isPending ? "animate-spin" : "",
              "text-zinc-500 group-hover:text-zinc-100 transition-colors duration-200",
            )}
          />
        </Button>
      </div>
    ),
    cell: ({ row }) => {
      const user = row.original

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
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(user.email)}>
              Copy email
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>View user</DropdownMenuItem>
            <DropdownMenuItem>Edit permissions</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
