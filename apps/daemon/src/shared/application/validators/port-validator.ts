/**
 * Port validation utilities
 *
 * Validates port numbers for network operations.
 */

/**
 * Validates port number
 *
 * @param port - The port number to validate
 * @throws Error if port is invalid
 */
export function validatePort(port: number): void {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Port must be an integer between 1 and 65535, got: ${port}`)
  }
}

/**
 * Checks if port is valid without throwing
 *
 * @param port - The port number to validate
 * @returns true if port is valid, false otherwise
 */
export function isValidPort(port: number): boolean {
  try {
    validatePort(port)
    return true
  } catch {
    return false
  }
}
