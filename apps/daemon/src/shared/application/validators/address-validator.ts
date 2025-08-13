/**
 * Address validation utilities
 *
 * Validates server address format and structure for ingress processing.
 */
import { isIP } from "node:net"

/**
 * Validates server address format
 *
 * @param address - The server address to validate
 * @throws Error if address is invalid
 */
export function validateAddress(address: string): void {
  if (!address || typeof address !== "string" || address.trim().length === 0) {
    throw new Error("Address must be a non-empty string")
  }

  // Extract IP part (remove port if included)
  const ipOnly = address.includes(":") ? address.split(":")[0] : address

  // Validate IP format (IPv4 or IPv6)
  if (ipOnly && isIP(ipOnly) === 0) {
    throw new Error(`Invalid IP address format: ${ipOnly}`)
  }
}

/**
 * Checks if address is valid without throwing
 *
 * @param address - The server address to validate
 * @returns true if address is valid, false otherwise
 */
export function isValidAddress(address: string): boolean {
  try {
    validateAddress(address)
    return true
  } catch {
    return false
  }
}
