import { DataTableConfig } from "@/features/common/types/data-table"

export interface PublicServerItem {
  serverId?: number | null
  name?: string | null
  address?: string | null
  port?: number | null
  activePlayers?: number | null
  maxPlayers?: number | null
  activeMap?: string | null
  game?: string | null
  city?: string | null
  country?: string | null
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
