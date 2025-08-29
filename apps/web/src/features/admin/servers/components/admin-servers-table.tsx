"use client"

import { DataTable, DataTableProps } from "@/features/common/components/data-table"
import { useDataTableUrl } from "@/features/common/hooks/use-data-table-url"
import { serverColumns, serverFilterConfig, ServerListItem } from "./server-columns"

interface AdminServersTableProps
  extends Omit<
    DataTableProps<ServerListItem>,
    | "columns"
    | "filterPlaceholder"
    | "serverConfig"
    | "onPageChange"
    | "onSort"
    | "onSearch"
    | "onRefresh"
    | "isLoading"
  > {
  data: ServerListItem[]
  totalCount: number
  currentPage: number
  pageSize: number
  sortField?: string
  sortOrder: "asc" | "desc"
  searchValue: string
}

export function AdminServersTable({
  data,
  currentPage = 1,
  pageSize = 10,
  sortField,
  sortOrder = "asc",
  searchValue = "",
  ...otherProps
}: AdminServersTableProps) {
  const config = {
    defaultSortField: "name",
    defaultSortOrder: "asc" as const,
    defaultPageSize: 10,
  }

  // Use URL hooks for server-side functionality
  const { handleSort, handlePageChange, handleSearch, handleRefresh, isPending } =
    useDataTableUrl(config)

  // Create wrapper functions that match DataTable's expected signatures
  const handlePageChangeWrapper = (page: number) => {
    const currentState = {
      page: currentPage,
      pageSize,
      sortField: sortField || config.defaultSortField,
      sortOrder,
      search: searchValue,
    }
    handlePageChange(page, currentState)
  }

  const handleSortWrapper = (field: string, order: "asc" | "desc") => {
    const currentState = {
      page: currentPage,
      pageSize,
      sortField: sortField || config.defaultSortField,
      sortOrder,
      search: searchValue,
    }
    handleSort(`${field}:${order}`, currentState)
  }

  const handleSearchWrapper = (value: string) => {
    const currentState = {
      page: currentPage,
      pageSize,
      sortField: sortField || config.defaultSortField,
      sortOrder,
      search: searchValue,
    }
    handleSearch(value, currentState)
  }

  return (
    <DataTable
      data={data}
      columns={serverColumns()}
      filterPlaceholder={serverFilterConfig.placeholder}
      serverConfig={config}
      currentPage={currentPage}
      pageSize={pageSize}
      sortField={sortField}
      sortOrder={sortOrder}
      searchValue={searchValue}
      enableActions={true}
      onPageChange={handlePageChangeWrapper}
      onSort={handleSortWrapper}
      onSearch={handleSearchWrapper}
      onRefresh={handleRefresh}
      isLoading={isPending}
      {...otherProps}
    />
  )
}
