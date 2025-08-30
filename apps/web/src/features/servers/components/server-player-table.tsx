"use client"

import { useState, useMemo, useCallback } from "react"
import { DataTable } from "@/features/common/components/data-table"
import { useDataTableUrl } from "@/features/common/hooks/use-data-table-url"
import { serverPlayerColumns, serverPlayerFilterConfig } from "./server-player-columns"
import { useServerPlayers, type ServerPlayerFilters } from "../hooks/use-server-players"
import { ServerPlayerFiltersComponent } from "./server-player-filters"

interface ServerPlayerTableProps {
  serverId: number
  currentPage?: number
  pageSize?: number
  sortField?: string
  sortOrder?: "asc" | "desc"
  searchValue?: string
  filters?: ServerPlayerFilters
  className?: string
}

export function ServerPlayerTable({
  serverId,
  currentPage = 1,
  pageSize = 25,
  sortField = "skill",
  sortOrder = "desc",
  searchValue = "",
  filters = {},
  className,
}: ServerPlayerTableProps) {
  const [localFilters, setLocalFilters] = useState<ServerPlayerFilters>(filters)

  // DataTable URL configuration
  const config = {
    defaultSortField: "skill",
    defaultSortOrder: "desc" as const,
    defaultPageSize: 25,
  }

  // Use URL hooks for server-side functionality
  const { handleSort, handlePageChange, handleSearch, handleRefresh, isPending } =
    useDataTableUrl(config)

  // Combine search value with other filters
  const combinedFilters = useMemo(
    () => ({
      ...localFilters,
      search: searchValue,
    }),
    [localFilters, searchValue],
  )

  // Fetch server players data
  const { players, totalCount, onlineCount, recentCount, loading, error, refetch } =
    useServerPlayers(serverId, combinedFilters, {
      page: currentPage,
      pageSize,
      sortField,
      sortOrder,
    })

  // Create wrapper functions that match DataTable's expected signatures
  const handlePageChangeWrapper = useCallback(
    (page: number) => {
      const currentState = {
        page: currentPage,
        pageSize,
        sortField: sortField || config.defaultSortField,
        sortOrder,
        search: searchValue,
      }
      handlePageChange(page, currentState)
    },
    [
      currentPage,
      pageSize,
      sortField,
      sortOrder,
      searchValue,
      handlePageChange,
      config.defaultSortField,
    ],
  )

  const handleSortWrapper = useCallback(
    (field: string, order: "asc" | "desc") => {
      const currentState = {
        page: currentPage,
        pageSize,
        sortField: sortField || config.defaultSortField,
        sortOrder,
        search: searchValue,
      }
      handleSort(`${field}:${order}`, currentState)
    },
    [currentPage, pageSize, sortField, sortOrder, searchValue, handleSort, config.defaultSortField],
  )

  const handleSearchWrapper = useCallback(
    (value: string) => {
      const currentState = {
        page: currentPage,
        pageSize,
        sortField: sortField || config.defaultSortField,
        sortOrder,
        search: searchValue,
      }
      handleSearch(value, currentState)
    },
    [
      currentPage,
      pageSize,
      sortField,
      sortOrder,
      searchValue,
      handleSearch,
      config.defaultSortField,
    ],
  )

  const handleRefreshWrapper = useCallback(() => {
    refetch()
    handleRefresh()
  }, [refetch, handleRefresh])

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: Partial<ServerPlayerFilters>) => {
    setLocalFilters((prev) => ({ ...prev, ...newFilters }))
  }, [])

  if (error) {
    console.error(error)
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
              Error loading players
            </h3>
            <div className="mt-2 text-sm text-red-700 dark:text-red-300">
              <p>Unable to load player data for this server. Please try again.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Stats Summary */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-2xl font-bold">{totalCount.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">Total Players</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-2xl font-bold text-green-400">{onlineCount.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">Online Now</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-2xl font-bold text-blue-400">{recentCount.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">Recent (7 days)</p>
        </div>
      </div>

      {/* Filter Controls */}
      <ServerPlayerFiltersComponent
        filters={localFilters}
        onFiltersChange={handleFilterChange}
        onlineCount={onlineCount}
        recentCount={recentCount}
        className="mb-6"
      />

      {/* Data Table */}
      <DataTable
        data={players}
        columns={serverPlayerColumns(serverId)}
        filterPlaceholder={serverPlayerFilterConfig.placeholder}
        serverConfig={config}
        currentPage={currentPage}
        pageSize={pageSize}
        sortField={sortField}
        sortOrder={sortOrder}
        searchValue={searchValue}
        totalCount={totalCount}
        enableActions={true}
        enableColumnVisibility={true}
        enableFiltering={true}
        enablePagination={true}
        enableSorting={true}
        onPageChange={handlePageChangeWrapper}
        onSort={handleSortWrapper}
        onSearch={handleSearchWrapper}
        onRefresh={handleRefreshWrapper}
        isLoading={loading || isPending}
      />
    </div>
  )
}
