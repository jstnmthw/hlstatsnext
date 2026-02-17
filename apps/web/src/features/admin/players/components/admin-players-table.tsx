"use client"

import { DataTable } from "@/features/common/components/data-table"
import { playerColumns, PlayerListItem, playerTableConfig } from "./player-columns"

export function AdminPlayersTable({
  data,
  totalCount,
}: {
  data: PlayerListItem[]
  totalCount: number
}) {
  return (
    <DataTable
      data={data}
      columns={playerColumns()}
      totalCount={totalCount}
      config={playerTableConfig}
    />
  )
}
