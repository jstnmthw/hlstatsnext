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
} from "./result.types";

export { isSuccess, isFailure, success, failure } from "./result.types";

// Pagination types
export type {
  PaginationInput,
  PaginationConfig,
  SortDirectionType,
  SortInput,
  PaginationMetadata,
  PaginatedResponse,
} from "./pagination.types";

export { SortDirection, DEFAULT_PAGINATION } from "./pagination.types";

// GraphQL error handling
export * from "./graphql-errors.types";
