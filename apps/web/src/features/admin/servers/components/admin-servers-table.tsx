"use client"

import { DataTable } from "@/features/common/components/data-table"
import type { ServerListItem } from "@/lib/servers"
import { serverColumns, serverTableConfig } from "./server-columns"

export function AdminServersTable({
  data,
  totalCount,
}: {
  data: ServerListItem[]
  totalCount: number
}) {
  return (
    <DataTable
      data={data}
      columns={serverColumns()}
      totalCount={totalCount}
      config={serverTableConfig}
    />
  )
}
