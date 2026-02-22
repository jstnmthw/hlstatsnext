import { ComponentType } from "react"

export interface FacetedFilterOption {
  label: string
  value: string
  icon?: ComponentType<{ className?: string }>
}

export interface FacetedFilterDefinition {
  id: string
  title: string
  options: FacetedFilterOption[]
  paramName?: string // URL param name, defaults to id
}

export interface DataTableConfig {
  defaultSortField: string
  defaultSortOrder: "asc" | "desc"
  defaultPageSize: number
  searchFields?: string[]
  filterPlaceholder?: string
  filters?: FacetedFilterDefinition[]
  frozenColumnsLeft?: string[]
  frozenColumnsRight?: string[]
}
