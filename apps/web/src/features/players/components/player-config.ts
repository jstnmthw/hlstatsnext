import { DataTableConfig } from "@/features/common/types/data-table"

export interface PublicPlayerItem {
  playerId: string
  lastName: string
  skill: number
  kills: number
  deaths: number
  country: string
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
}
