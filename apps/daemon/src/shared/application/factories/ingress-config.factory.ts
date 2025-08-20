/**
 * Ingress Configuration Factory
 *
 * Handles resolution of ingress service options with environment variable
 * fallbacks and development defaults.
 */

import type { IngressOptions } from "@/modules/ingress/ingress.types"

/**
 * Environment variable names for ingress configuration
 */
const INGRESS_ENV_VARS = {
  PORT: "INGRESS_PORT",
  NODE_ENV: "NODE_ENV",
} as const

/**
 * Default ingress configuration values
 */
const INGRESS_DEFAULTS = {
  port: 27500,
  host: "0.0.0.0",
} as const

/**
 * Creates resolved ingress options from provided options and environment variables
 *
 * @param ingressOptions - Optional user-provided ingress options
 * @returns Fully resolved ingress options with environment and default fallbacks
 */
export function createIngressConfig(ingressOptions?: IngressOptions): IngressOptions {
  const port = resolveIngressPort(ingressOptions?.port)
  const host = resolveIngressHost(ingressOptions?.host)
  const skipAuth = resolveSkipAuth(ingressOptions?.skipAuth)
  const logBots = resolveLogBots(ingressOptions?.logBots)

  return {
    port,
    host,
    skipAuth,
    logBots,
  }
}

/**
 * Resolves ingress port with precedence: options > env > default
 */
function resolveIngressPort(optionsPort?: number): number {
  if (optionsPort !== undefined) {
    return optionsPort
  }

  const envPort = process.env[INGRESS_ENV_VARS.PORT]
  if (envPort) {
    const parsed = parseInt(envPort, 10)
    if (isNaN(parsed) || parsed <= 0 || parsed > 65535) {
      throw new Error(`Invalid INGRESS_PORT: ${envPort}. Must be between 1 and 65535.`)
    }
    return parsed
  }

  return INGRESS_DEFAULTS.port
}

/**
 * Resolves ingress host with options fallback to default
 */
function resolveIngressHost(optionsHost?: string): string {
  return optionsHost ?? INGRESS_DEFAULTS.host
}

/**
 * Resolves skipAuth flag with development environment detection
 */
function resolveSkipAuth(optionsSkipAuth?: boolean): boolean {
  if (optionsSkipAuth !== undefined) {
    return optionsSkipAuth
  }

  return isDevelopmentEnvironment()
}

/**
 * Resolves logBots flag with development environment detection
 */
function resolveLogBots(optionsLogBots?: boolean): boolean {
  if (optionsLogBots !== undefined) {
    return optionsLogBots
  }

  return isDevelopmentEnvironment()
}

/**
 * Checks if current environment is development
 */
function isDevelopmentEnvironment(): boolean {
  return process.env[INGRESS_ENV_VARS.NODE_ENV] === "development"
}
