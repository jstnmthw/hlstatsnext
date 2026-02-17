import { DataTableConfig } from "@/features/common/types/data-table"

export interface PublicServerItem {
  serverId: string
  name: string
  address: string
  port: number
  activePlayers: number
  maxPlayers: number
  lastEvent?: string | Date | null
}

// Homepage — compact columns (no toolbar, no pagination)
export const recentServerTableConfig: DataTableConfig = {
  defaultSortField: "activePlayers",
  defaultSortOrder: "desc",
  defaultPageSize: 50,
}

// /servers page — full columns (toolbar, sorting, pagination)
export const serverPageTableConfig: DataTableConfig = {
  defaultSortField: "activePlayers",
  defaultSortOrder: "desc",
  defaultPageSize: 25,
  searchFields: ["name", "address", "game"],
  filterPlaceholder: "Search servers...",
}
