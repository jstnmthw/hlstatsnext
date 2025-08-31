/**
 * Shared server validation utilities
 *
 * Provides reusable validation functions for server-related data
 * following best practices from the daemon's validator patterns.
 * Uses Node.js built-in functions for robust validation where available.
 */

import { isIP } from "node:net"

/**
 * Validates IPv4 address format using Node.js built-in validation
 * More robust than regex-based validation as it handles edge cases properly
 * @param ip - The IP address to validate
 * @returns true if valid IPv4 address, false otherwise
 */
export function isValidIPAddress(ip: string): boolean {
  // Use Node.js built-in isIP function for robust validation
  // Returns 4 for IPv4, 6 for IPv6, 0 for invalid
  return isIP(ip) === 4
}

/**
 * Validates port number range
 * @param port - The port number to validate
 * @returns true if valid port (1-65535), false otherwise
 */
export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535
}

/**
 * Validates Docker hostname format
 * @param hostname - The Docker hostname to validate
 * @returns true if valid hostname format, false otherwise
 */
export function isValidDockerHost(hostname: string): boolean {
  if (!hostname || typeof hostname !== "string") {
    return false
  }

  // Allow alphanumeric, dots, underscores, and hyphens
  const dockerHostRegex = /^[a-zA-Z0-9._-]+$/
  return dockerHostRegex.test(hostname) && hostname.length <= 255
}

/**
 * Validates URL format (for status URLs)
 * @param url - The URL to validate
 * @returns true if valid URL format, false otherwise
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Extracts IP address from address:port string
 * Useful for validating server addresses that might include ports
 * @param address - Address string potentially containing port
 * @returns The IP portion of the address
 */
export function extractIPFromAddress(address: string): string {
  return address.includes(":") ? address.split(":")[0]! : address
}

/**
 * Sanitizes and validates IPv4 address by extracting just the IP portion
 * @param address - Address string potentially containing port
 * @returns Sanitized IPv4 address or null if invalid
 */
export function sanitizeIPAddress(address: string): string | null {
  const ipOnly = extractIPFromAddress(address)
  return isValidIPAddress(ipOnly) ? ipOnly : null
}
