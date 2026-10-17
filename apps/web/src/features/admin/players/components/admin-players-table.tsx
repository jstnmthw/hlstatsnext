"use client"

import { DataTable } from "@/features/common/components/data-table"
import type { PlayerListItem } from "@/lib/players"
import { playerColumns, playerTableConfig } from "./player-columns"

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
