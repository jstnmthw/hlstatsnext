"use client"

import { ServerListItem, serverColumns, serverFilterConfig } from "./server-columns"
import { ServerDataTable } from "@/features/common/components/server-data-table"
import { DataTableUrlState } from "@/features/common/hooks/use-data-table-url"

interface ServerDataTableProps {
  data: ServerListItem[]
  totalCount: number
  currentPage: number
  pageSize: number
  sortField: string
  sortOrder: "asc" | "desc"
  search: string
}

const SERVER_TABLE_CONFIG = {
  defaultSortField: "name",
  defaultSortOrder: "asc" as const,
  defaultPageSize: 10,
}

export function ServerTable({
  data,
  totalCount,
  currentPage,
  pageSize,
  sortField,
  sortOrder,
  search,
}: ServerDataTableProps) {
  const currentState: DataTableUrlState = {
    page: currentPage,
    pageSize,
    sortField,
    sortOrder,
    search,
  }

  const columns = serverColumns()

  return (
    <ServerDataTable
      data={data}
      columns={columns}
      filterConfig={serverFilterConfig}
      totalCount={totalCount}
      currentState={currentState}
      config={SERVER_TABLE_CONFIG}
      enableActions={true}
    />
  )
}
