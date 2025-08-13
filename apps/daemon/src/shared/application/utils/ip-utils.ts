/**
 * IP address utility functions
 *
 * Utilities for IP address manipulation and conversion.
 */
import { isIP } from "node:net"

/**
 * Safely converts IPv4 address to BigInt for GeoIP lookup
 *
 * @param ip - The IPv4 address string
 * @returns BigInt representation of the IP address, or null for invalid IPv4 addresses
 */
export function ipv4ToBigInt(ip: string): bigint | null {
  const parts = ip.split(".").map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null
  }

  const [a, b, c, d] = parts
  return (BigInt(a!) << 24n) | (BigInt(b!) << 16n) | (BigInt(c!) << 8n) | BigInt(d!)
}

/**
 * Checks if a string is a valid IPv4 address
 *
 * @param ip - The IP address string to validate
 * @returns true if valid IPv4, false otherwise
 */
export function isIPv4(ip: string): boolean {
  return isIP(ip) === 4
}

/**
 * Checks if a string is a valid IPv6 address
 *
 * @param ip - The IP address string to validate
 * @returns true if valid IPv6, false otherwise
 */
export function isIPv6(ip: string): boolean {
  return isIP(ip) === 6
}

/**
 * Extracts IP address from address:port string
 *
 * @param address - Address string potentially containing port
 * @returns The IP portion of the address
 */
export function extractIpFromAddress(address: string): string {
  return address.includes(":") ? address.split(":")[0]! : address
}

/**
 * Sanitizes IP address by extracting just the IP portion
 *
 * @param address - Address string potentially containing port
 * @returns Sanitized IP address or null if invalid
 */
export function sanitizeIpAddress(address: string): string | null {
  const ipOnly = extractIpFromAddress(address)
  return isIP(ipOnly) > 0 ? ipOnly : null
}
