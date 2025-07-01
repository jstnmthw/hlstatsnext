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
