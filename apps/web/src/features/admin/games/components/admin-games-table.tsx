"use client"

import { DataTable } from "@/features/common/components/data-table"
import { gameColumns, GameListItem, gameTableConfig } from "./game-columns"

export function AdminGamesTable({
  data,
  totalCount,
}: {
  data: GameListItem[]
  totalCount: number
}) {
  return (
    <DataTable
      data={data}
      columns={gameColumns()}
      totalCount={totalCount}
      config={gameTableConfig}
    />
  )
}
