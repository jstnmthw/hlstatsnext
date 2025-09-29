export interface WhereFilter {
  OR?: Array<Record<string, { contains: string }>>
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
}

export interface SearchFilter {
  OR: Array<Record<string, { contains: string }>>
}

export function buildPaginationVariables(
  params: PaginationParams,
  searchFields: string[] = [],
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

  // Add search filter
  if (params.search && searchFields.length > 0) {
    variables.where = {
      OR: searchFields.map((field) => ({
        [field]: { contains: params.search },
      })),
    }
  }

  return variables
}

export function buildCountVariables(
  params: PaginationParams,
  searchFields: string[] = [],
): { where?: WhereFilter } {
  const variables: { where?: WhereFilter } = {}

  // Add search filter (same as pagination query)
  if (params.search && searchFields.length > 0) {
    variables.where = {
      OR: searchFields.map((field) => ({
        [field]: { contains: params.search },
      })),
    }
  }

  return variables
}

export function parseUrlParams(
  searchParams: Record<string, string | undefined>,
  defaults: {
    sortField: string
    sortOrder: "asc" | "desc"
    pageSize: number
  },
): PaginationParams {
  return {
    page: Number(searchParams.page) || 1,
    pageSize: Number(searchParams.pageSize) || defaults.pageSize,
    sortField: searchParams.sortField || defaults.sortField,
    sortOrder: (searchParams.sortOrder as "asc" | "desc") || defaults.sortOrder,
    search: searchParams.search || "",
  }
}
