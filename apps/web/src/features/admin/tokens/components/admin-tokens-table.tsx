"use client"

import { DataTable } from "@/features/common/components/data-table"
import { tokenColumns, TokenListItem, tokenTableConfig } from "./token-columns"

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
