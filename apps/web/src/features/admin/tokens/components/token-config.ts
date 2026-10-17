import { DataTableConfig } from "@/features/common/types/data-table"

export const tokenTableConfig: DataTableConfig = {
  defaultSortField: "createdAt",
  defaultSortOrder: "desc",
  defaultPageSize: 10,
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
