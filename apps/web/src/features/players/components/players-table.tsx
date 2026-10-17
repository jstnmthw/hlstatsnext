"use client"

import { DataTable } from "@/features/common/components/data-table"
import type { PublicPlayerItem } from "@/lib/players"
import { playerPageColumns, playerPageTableConfig } from "./player-columns"

/** Full-featured table for /players — toolbar, sorting, pagination */
export function PlayersTable({
  data,
  totalCount,
}: {
  data: PublicPlayerItem[]
  totalCount: number
}) {
  return (
    <DataTable
      data={data}
      columns={playerPageColumns}
      totalCount={totalCount}
      config={playerPageTableConfig}
    />
  )
}
