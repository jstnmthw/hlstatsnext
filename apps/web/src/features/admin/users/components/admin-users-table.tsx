"use client"

import { DataTable } from "@/features/common/components/data-table"
import { userColumns, UserListItem, userTableConfig } from "./user-columns"

export function AdminUsersTable({
  data,
  totalCount,
}: {
  data: UserListItem[]
  totalCount: number
}) {
  return (
    <DataTable
      data={data}
      columns={userColumns()}
      totalCount={totalCount}
      config={userTableConfig}
    />
  )
}
