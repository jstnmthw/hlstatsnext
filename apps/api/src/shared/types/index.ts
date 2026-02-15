// Result and error handling types
export type {
  AppError,
  DatabaseError,
  Failure,
  NotFoundError,
  PaginatedResult,
  Result,
  Success,
  UnauthorizedError,
  ValidationError,
} from "./result.types"

// Pagination types
export type {
  PaginatedResponse,
  PaginationConfig,
  PaginationInput,
  PaginationMetadata,
} from "./pagination.types"

export { DEFAULT_PAGINATION } from "./pagination.types"
