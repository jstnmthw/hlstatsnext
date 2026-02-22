import { DataTableConfig } from "@/features/common/types/data-table"

export interface TokenListItem {
  id: number
  tokenPrefix: string
  name: string
  game: string
  createdAt: string | Date
  expiresAt?: string | Date | null
  revokedAt?: string | Date | null
  lastUsedAt?: string | Date | null
  createdBy: string
  serverCount: number
  status: string
  hasRconPassword: boolean
  __typename?: string
}

export const tokenTableConfig: DataTableConfig = {
  defaultSortField: "createdAt",
  defaultSortOrder: "desc",
  defaultPageSize: 10,
  searchFields: ["name", "tokenPrefix", "game"],
  filterPlaceholder: "Filter tokens...",
  filters: [
    {
      id: "status",
      title: "Status",
      options: [
        { label: "Active", value: "active" },
        { label: "Revoked", value: "revoked" },
        { label: "Expired", value: "expired" },
      ],
    },
  ],
  frozenColumnsLeft: ["select"],
  frozenColumnsRight: ["actions"],
}
