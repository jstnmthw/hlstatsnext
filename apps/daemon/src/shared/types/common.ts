/**
 * Common types shared across modules
 */

export interface ServiceResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface HandlerResult {
  success: boolean
  error?: string
  affected?: number
}

export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E }

export interface PaginationOptions {
  limit?: number
  offset?: number
}

export interface FilterOptions {
  timeframe?: "day" | "week" | "month" | "year" | "all"
  gameMode?: string
  minMatches?: number
}