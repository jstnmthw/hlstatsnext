"use client"

import { PlayerListItem, playerColumns, playerFilterConfig } from "./player-columns"
import { ServerDataTable } from "@/features/common/components/server-data-table"
import { DataTableUrlState } from "@/features/common/types/data-table"

interface PlayerDataTableProps {
  data: PlayerListItem[]
  totalCount: number
  currentPage: number
  pageSize: number
  sortField: string
  sortOrder: "asc" | "desc"
  search: string
}

const PLAYER_TABLE_CONFIG = {
  defaultSortField: "lastName",
  defaultSortOrder: "asc" as const,
  defaultPageSize: 10,
}

export function PlayerDataTable({
  data,
  totalCount,
  currentPage,
  pageSize,
  sortField,
  sortOrder,
  search,
}: PlayerDataTableProps) {
  const currentState: DataTableUrlState = {
    page: currentPage,
    pageSize,
    sortField,
    sortOrder,
    search,
  }

  const columns = playerColumns({
    sortField,
    sortOrder,
    onSort: () => {}, // Will be handled by ServerDataTable
    onRefresh: () => {}, // Will be handled by ServerDataTable
    isPending: false, // Will be handled by ServerDataTable
  })

  return (
    <ServerDataTable
      data={data}
      columns={columns}
      filterConfig={playerFilterConfig}
      totalCount={totalCount}
      currentState={currentState}
      config={PLAYER_TABLE_CONFIG}
      enableActions={true}
    />
  )
}
