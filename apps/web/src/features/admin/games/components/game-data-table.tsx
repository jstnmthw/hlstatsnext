"use client"

import { GameListItem, gameColumns, gameFilterConfig } from "./game-columns"
import { ServerDataTable } from "@/features/common/components/server-data-table"
import { DataTableUrlState } from "@/features/common/hooks/use-data-table-url"

interface GameDataTableProps {
  data: GameListItem[]
  totalCount: number
  currentPage: number
  pageSize: number
  sortField: string
  sortOrder: "asc" | "desc"
  search: string
}

const GAME_TABLE_CONFIG = {
  defaultSortField: "name",
  defaultSortOrder: "asc" as const,
  defaultPageSize: 10,
}

export function GameDataTable({
  data,
  totalCount,
  currentPage,
  pageSize,
  sortField,
  sortOrder,
  search,
}: GameDataTableProps) {
  const currentState: DataTableUrlState = {
    page: currentPage,
    pageSize,
    sortField,
    sortOrder,
    search,
  }

  const columns = gameColumns()

  return (
    <ServerDataTable
      data={data}
      columns={columns}
      filterConfig={gameFilterConfig}
      totalCount={totalCount}
      currentState={currentState}
      config={GAME_TABLE_CONFIG}
      enableActions={true}
    />
  )
}
