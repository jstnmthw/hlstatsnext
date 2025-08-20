/**
 * RCON Configuration Factory
 *
 * Handles parsing and validation of RCON configuration from environment
 * variables with proper defaults and type safety.
 */

export interface RconConfig {
  enabled: boolean
  timeout: number
  maxRetries: number
  statusInterval: number
  maxConnectionsPerServer: number
}

/**
 * Environment variable names for RCON configuration
 */
const RCON_ENV_VARS = {
  ENABLED: "RCON_ENABLED",
  TIMEOUT: "RCON_TIMEOUT",
  MAX_RETRIES: "RCON_MAX_RETRIES",
  STATUS_INTERVAL: "RCON_STATUS_INTERVAL",
} as const

/**
 * Default RCON configuration values
 */
const RCON_DEFAULTS = {
  enabled: false,
  timeout: 5000,
  maxRetries: 3,
  statusInterval: 30000,
  maxConnectionsPerServer: 1,
} as const

/**
 * Creates RCON configuration from environment variables with validation
 *
 * @returns Validated RCON configuration object
 * @throws Error if environment variables contain invalid values
 */
export function createRconConfig(): RconConfig {
  const enabled = parseRconEnabled()
  const timeout = parseRconTimeout()
  const maxRetries = parseRconMaxRetries()
  const statusInterval = parseRconStatusInterval()

  return {
    enabled,
    timeout,
    maxRetries,
    statusInterval,
    maxConnectionsPerServer: RCON_DEFAULTS.maxConnectionsPerServer,
  }
}

/**
 * Parses RCON enabled flag from environment
 */
function parseRconEnabled(): boolean {
  return process.env[RCON_ENV_VARS.ENABLED] === "true"
}

/**
 * Parses RCON timeout with validation
 */
function parseRconTimeout(): number {
  const value = process.env[RCON_ENV_VARS.TIMEOUT]
  if (!value) return RCON_DEFAULTS.timeout

  const parsed = parseInt(value, 10)
  if (isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid RCON_TIMEOUT: ${value}. Must be a positive integer.`)
  }

  return parsed
}

/**
 * Parses RCON max retries with validation
 */
function parseRconMaxRetries(): number {
  const value = process.env[RCON_ENV_VARS.MAX_RETRIES]
  if (!value) return RCON_DEFAULTS.maxRetries

  const parsed = parseInt(value, 10)
  if (isNaN(parsed) || parsed < 0) {
    throw new Error(`Invalid RCON_MAX_RETRIES: ${value}. Must be a non-negative integer.`)
  }

  return parsed
}

/**
 * Parses RCON status interval with validation
 */
function parseRconStatusInterval(): number {
  const value = process.env[RCON_ENV_VARS.STATUS_INTERVAL]
  if (!value) return RCON_DEFAULTS.statusInterval

  const parsed = parseInt(value, 10)
  if (isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid RCON_STATUS_INTERVAL: ${value}. Must be a positive integer.`)
  }

  return parsed
}
