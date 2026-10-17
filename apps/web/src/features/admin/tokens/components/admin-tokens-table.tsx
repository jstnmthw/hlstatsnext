"use client"

import { DataTable } from "@/features/common/components/data-table"
import type { TokenListItem } from "@/lib/tokens"
import { tokenColumns } from "./token-columns"
import { tokenTableConfig } from "./token-config"

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
