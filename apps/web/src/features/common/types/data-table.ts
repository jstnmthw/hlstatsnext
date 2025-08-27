export interface FilterConfig {
  columnId: string
  placeholder: string
  label?: string
}

export interface DataTableOptions {
  totalCount: number
  currentPage: number
  pageSize: number
  sortField?: string
  sortOrder?: "asc" | "desc"
  search?: string
  onPageChange: (page: number) => void
  onSort: (field: string) => void
  onSearch: (search: string) => void
  onRefresh: () => void
  isPending?: boolean
}

export interface DataTableConfig {
  defaultSortField: string
  defaultSortOrder: "asc" | "desc"
  defaultPageSize: number
}

export interface DataTableUrlState {
  page: number
  sortField: string
  sortOrder: "asc" | "desc"
  search: string
  pageSize: number
}
