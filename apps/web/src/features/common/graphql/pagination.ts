import { DataTableConfig, FacetedFilterDefinition } from "@/features/common/types/data-table"

export interface WhereFilter {
  OR?: Array<Record<string, { contains: string }>>
  AND?: Array<Record<string, unknown>>
  [key: string]: unknown
}

export interface PaginationVariables {
  take: number
  skip: number
  orderBy?: Array<Record<string, "asc" | "desc" | Record<string, "asc" | "desc">>>
  where?: WhereFilter
}

export interface PaginationParams {
  page: number
  pageSize: number
  sortField: string
  sortOrder: "asc" | "desc"
  search: string
  filters: Record<string, string[]>
}

export interface SearchFilter {
  OR: Array<Record<string, { contains: string }>>
}

/**
 * Custom transform for a filter's values into a where clause.
 * Return the where clause fragment, or undefined to skip.
 */
export type FilterTransform = (values: string[]) => Record<string, unknown> | undefined

function buildWhereClause(
  params: PaginationParams,
  searchFields: string[],
  filterTransforms?: Record<string, FilterTransform>,
): WhereFilter | undefined {
  const clauses: WhereFilter = {}

  // Search OR clause
  if (params.search && searchFields.length > 0) {
    clauses.OR = searchFields.map((field) => ({
      [field]: { contains: params.search },
    }))
  }

  // Filter AND clauses
  const filterAnds: Array<Record<string, unknown>> = []
  for (const [field, values] of Object.entries(params.filters)) {
    if (values.length === 0) continue

    const transform = filterTransforms?.[field]
    if (transform) {
      const clause = transform(values)
      if (clause) {
        filterAnds.push(clause)
      }
    } else {
      // Default: { field: { in: values } }
      filterAnds.push({ [field]: { in: values } })
    }
  }

  if (filterAnds.length > 0) {
    clauses.AND = filterAnds
  }

  if (clauses.OR || clauses.AND) {
    return clauses
  }
  return undefined
}

export function buildPaginationVariables(
  params: PaginationParams,
  searchFields: string[] = [],
  filterTransforms?: Record<string, FilterTransform>,
): PaginationVariables {
  const variables: PaginationVariables = {
    take: params.pageSize,
    skip: (params.page - 1) * params.pageSize,
  }

  // Add sorting
  if (params.sortField) {
    // Handle nested field names for relations (e.g., "player.lastName" → { player: { lastName: "asc" } })
    if (params.sortField.includes(".")) {
      const [relation, field] = params.sortField.split(".", 2)
      if (relation && field) {
        const orderByObject: Record<string, "asc" | "desc" | Record<string, "asc" | "desc">> = {}
        orderByObject[relation] = { [field]: params.sortOrder || "asc" }
        variables.orderBy = [orderByObject]
      }
    } else {
      variables.orderBy = [{ [params.sortField]: params.sortOrder || "asc" }]
    }
  }

  const where = buildWhereClause(params, searchFields, filterTransforms)
  if (where) {
    variables.where = where
  }

  return variables
}

export function buildCountVariables(
  params: PaginationParams,
  searchFields: string[] = [],
  filterTransforms?: Record<string, FilterTransform>,
): { where?: WhereFilter } {
  const where = buildWhereClause(params, searchFields, filterTransforms)
  return where ? { where } : {}
}

export function parseUrlParams(
  searchParams: Record<string, string | undefined>,
  defaults: {
    sortField: string
    sortOrder: "asc" | "desc"
    pageSize: number
  },
  filterDefinitions?: FacetedFilterDefinition[],
): PaginationParams {
  const filters: Record<string, string[]> = {}

  if (filterDefinitions) {
    for (const filter of filterDefinitions) {
      const paramName = filter.paramName || filter.id
      const value = searchParams[paramName]
      if (value) {
        filters[filter.id] = value.split(",")
      }
    }
  }

  return {
    page: Number(searchParams.page) || 1,
    pageSize: Number(searchParams.pageSize) || defaults.pageSize,
    sortField: searchParams.sortField || defaults.sortField,
    sortOrder: (searchParams.sortOrder as "asc" | "desc") || defaults.sortOrder,
    search: searchParams.search || "",
    filters,
  }
}

/** Extract config defaults from a DataTableConfig for use with parseUrlParams */
export function getConfigDefaults(config: DataTableConfig) {
  return {
    sortField: config.defaultSortField,
    sortOrder: config.defaultSortOrder,
    pageSize: config.defaultPageSize,
  }
}
