import {
  DEFAULT_PAGINATION,
  PaginationConfig,
  PaginationInput,
  PaginationMetadata,
} from "@/shared/types"

/**
 * Utility function to create pagination config
 */
export function createPaginationConfig(input: PaginationInput): PaginationConfig {
  const page = Math.max(1, input.page ?? DEFAULT_PAGINATION.PAGE)
  const limit = Math.min(
    Math.max(1, input.limit ?? DEFAULT_PAGINATION.LIMIT),
    DEFAULT_PAGINATION.MAX_LIMIT,
  )
  const skip = (page - 1) * limit

  return { page, limit, skip }
}

/**
 * Utility function to create pagination metadata
 */
export function createPaginationMetadata(
  total: number,
  config: PaginationConfig,
): PaginationMetadata {
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
