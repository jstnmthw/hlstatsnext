"use client"

import { DataTable } from "@/features/common/components/data-table"
import { columns, PlayerListItem } from "./player-columns"

export function PlayerTable({ data }: { data: PlayerListItem[] }) {
  return <DataTable columns={columns} data={data} />
}
