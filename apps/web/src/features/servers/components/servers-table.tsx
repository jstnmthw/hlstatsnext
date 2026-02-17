"use client"

import { DataTable } from "@/features/common/components/data-table"
import {
  PublicServerItem,
  recentServerColumns,
  recentServerTableConfig,
  serverPageColumns,
  serverPageTableConfig,
} from "./server-columns"

/** Compact table for the homepage — no toolbar, no pagination, border-bottom style */
export function RecentServersTable({ data }: { data: PublicServerItem[] }) {
  return (
    <DataTable
      data={data}
      columns={recentServerColumns}
      totalCount={data.length}
      config={recentServerTableConfig}
      showToolbar={false}
      showPagination={false}
      borderStyle="border-bottom"
    />
  )
}

/** Full-featured table for /servers — toolbar, sorting, pagination */
export function ServersTable({
  data,
  totalCount,
}: {
  data: PublicServerItem[]
  totalCount: number
}) {
  return (
    <DataTable
      data={data}
      columns={serverPageColumns}
      totalCount={totalCount}
      config={serverPageTableConfig}
    />
  )
}
