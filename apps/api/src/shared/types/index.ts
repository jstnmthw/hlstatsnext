// Result and error handling types
export type {
  Result,
  Success,
  Failure,
  PaginatedResult,
  AppError,
  NotFoundError,
  ValidationError,
  DatabaseError,
  UnauthorizedError,
} from "./result.types"

// Pagination types
export type {
  PaginationInput,
  PaginationConfig,
  PaginationMetadata,
  PaginatedResponse,
} from "./pagination.types"

export { DEFAULT_PAGINATION } from "./pagination.types"
