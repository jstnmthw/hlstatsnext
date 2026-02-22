"use client"

import { DataTable } from "@/features/common/components/data-table"
import { tokenColumns } from "./token-columns"
import { TokenListItem, tokenTableConfig } from "./token-config"

export function AdminTokensTable({
  data,
  totalCount,
}: {
  data: TokenListItem[]
  totalCount: number
}) {
  return (
    <DataTable
      data={data}
      columns={tokenColumns()}
      totalCount={totalCount}
      config={tokenTableConfig}
    />
  )
}
