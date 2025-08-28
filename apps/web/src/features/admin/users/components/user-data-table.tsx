"use client"

import { UserListItem, userColumns, userFilterConfig } from "./user-columns"
import { ServerDataTable } from "@/features/common/components/server-data-table"
import { DataTableUrlState } from "@/features/common/hooks/use-data-table-url"

interface UserDataTableProps {
  data: UserListItem[]
  totalCount: number
  currentPage: number
  pageSize: number
  sortField: string
  sortOrder: "asc" | "desc"
  search: string
}

const USER_TABLE_CONFIG = {
  defaultSortField: "username",
  defaultSortOrder: "asc" as const,
  defaultPageSize: 10,
}

export function UserDataTable({
  data,
  totalCount,
  currentPage,
  pageSize,
  sortField,
  sortOrder,
  search,
}: UserDataTableProps) {
  const currentState: DataTableUrlState = {
    page: currentPage,
    pageSize,
    sortField,
    sortOrder,
    search,
  }

  const columns = userColumns()

  return (
    <ServerDataTable
      data={data}
      columns={columns}
      filterConfig={userFilterConfig}
      totalCount={totalCount}
      currentState={currentState}
      config={USER_TABLE_CONFIG}
      enableActions={true}
    />
  )
}
