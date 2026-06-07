import { DataTableConfig } from "@/features/common/types/data-table"

export interface PublicPlayerItem {
  playerId?: number | null
  lastName?: string | null
  skill?: number | null
  kills?: number | null
  deaths?: number | null
  country?: string | null
  flag?: string | null
  lastEvent?: string | Date | null
}

// /players page — full columns (toolbar, sorting, pagination)
export const playerPageTableConfig: DataTableConfig = {
  defaultSortField: "skill",
  defaultSortOrder: "desc",
  defaultPageSize: 25,
  searchFields: ["lastName"],
  filterPlaceholder: "Search by player name...",
  // Bots are hidden by default; this surfaces ?showBots=true as a toolbar switch.
  toggles: [{ id: "showBots", label: "Show bots" }],
}
