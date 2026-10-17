import { DataTableConfig } from "@/features/common/types/data-table"

// /players page — full columns (toolbar, sorting, pagination)
export const playerPageTableConfig: DataTableConfig = {
  defaultSortField: "skill",
  defaultSortOrder: "desc",
  defaultPageSize: 25,
  filterPlaceholder: "Search by player name...",
  // Bots are hidden by default; this surfaces ?showBots=true as a toolbar switch.
  toggles: [{ id: "showBots", label: "Show bots" }],
}
