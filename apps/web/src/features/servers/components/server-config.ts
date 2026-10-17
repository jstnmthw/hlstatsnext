import { DataTableConfig } from "@/features/common/types/data-table"

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
  filterPlaceholder: "Search servers...",
}
