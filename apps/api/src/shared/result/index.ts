/**
 * Result type for handling success/error states in a type-safe manner
 */

export interface Success<T> {
  readonly success: true
  readonly data: T
}

export interface Failure<E = Error> {
  readonly success: false
  readonly error: E
}

export type Result<T, E = Error> = Success<T> | Failure<E>

/**
 * Type guard to check if a result is successful
 */
export function isSuccess<T, E>(result: Result<T, E>): result is Success<T> {
  return result.success === true
}

/**
 * Type guard to check if a result is a failure
 */
export function isFailure<T, E>(result: Result<T, E>): result is Failure<E> {
  return result.success === false
}

/**
 * Helper function to create a success result
 */
export function success<T>(data: T): Success<T> {
  return { success: true, data }
}

/**
 * Helper function to create a failure result
 */
export function failure<E = Error>(error: E): Failure<E> {
  return { success: false, error }
}
