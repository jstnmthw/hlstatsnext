/**
 * Standard pagination input parameters
 */
export interface PaginationInput {
  readonly page?: number
  readonly limit?: number
}

/**
 * Pagination configuration with defaults
 */
export interface PaginationConfig {
  readonly page: number
  readonly limit: number
  readonly skip: number
}

/**
 * Sorting direction enum
 */
export const SortDirection = {
  ASC: "asc",
  DESC: "desc",
} as const

export type SortDirectionType = (typeof SortDirection)[keyof typeof SortDirection]

/**
 * Generic sort input
 */
export interface SortInput<TField extends string> {
  readonly field: TField
  readonly direction: SortDirectionType
}

/**
 * Pagination metadata
 */
export interface PaginationMetadata {
  readonly currentPage: number
  readonly totalPages: number
  readonly totalItems: number
  readonly itemsPerPage: number
  readonly hasNextPage: boolean
  readonly hasPreviousPage: boolean
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  readonly items: readonly T[]
  readonly pagination: PaginationMetadata
}

/**
 * Default pagination values
 */
export const DEFAULT_PAGINATION = {
  PAGE: 1,
  LIMIT: 50,
  MAX_LIMIT: 100,
} as const

/**
 * Utility function to create pagination config
 */
export function createPaginationConfig(input: PaginationInput): PaginationConfig {
  const page = Math.max(1, input.page ?? DEFAULT_PAGINATION.PAGE)
  const limit = Math.min(Math.max(1, input.limit ?? DEFAULT_PAGINATION.LIMIT), DEFAULT_PAGINATION.MAX_LIMIT)
  const skip = (page - 1) * limit

  return { page, limit, skip }
}

/**
 * Utility function to create pagination metadata
 */
export function createPaginationMetadata(total: number, config: PaginationConfig): PaginationMetadata {
  const totalPages = Math.ceil(total / config.limit)
  const hasNextPage = config.page < totalPages
  const hasPreviousPage = config.page > 1

  return {
    currentPage: config.page,
    totalPages,
    totalItems: total,
    itemsPerPage: config.limit,
    hasNextPage,
    hasPreviousPage,
  }
}
