"use client"

import { useCallback } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "./data-table"
import { FilterConfig } from "../types/data-table"
import { useDataTableUrl, DataTableConfig, DataTableUrlState } from "../hooks/use-data-table-url"

interface ServerDataTableProps<TData, TValue> {
  data: TData[]
  columns: ColumnDef<TData, TValue>[]
  filterConfig?: FilterConfig
  totalCount: number
  currentState: DataTableUrlState
  config: DataTableConfig
  enableActions?: boolean
}

export function ServerDataTable<TData, TValue>({
  data,
  columns,
  filterConfig,
  totalCount,
  currentState,
  config,
  enableActions = true,
}: ServerDataTableProps<TData, TValue>) {
  const { handleSort, handlePageChange, handleSearch, handleRefresh, isPending } =
    useDataTableUrl(config)

  const handleSortWrapper = useCallback(
    (fieldWithDirection: string) => {
      handleSort(fieldWithDirection, currentState)
    },
    [handleSort, currentState],
  )

  const handlePageChangeWrapper = useCallback(
    (page: number) => {
      handlePageChange(page, currentState)
    },
    [handlePageChange, currentState],
  )

  const handleSearchWrapper = useCallback(
    (searchValue: string) => {
      handleSearch(searchValue, currentState)
    },
    [handleSearch, currentState],
  )

  // Filter out actions column if actions are disabled (for public/read-only views)
  const filteredColumns = enableActions ? columns : columns.filter((col) => col.id !== "actions")

  return (
    <DataTable
      columns={filteredColumns}
      data={data}
      filterConfig={filterConfig}
      options={{
        totalCount,
        currentPage: currentState.page,
        pageSize: currentState.pageSize,
        sortField: currentState.sortField,
        sortOrder: currentState.sortOrder,
        search: currentState.search,
        onPageChange: handlePageChangeWrapper,
        onSort: handleSortWrapper,
        onSearch: handleSearchWrapper,
        onRefresh: handleRefresh,
        isPending,
      }}
    />
  )
}
