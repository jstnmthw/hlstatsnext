/**
 * Ingress module type definitions
 *
 * Core types for the ingress authentication and processing system.
 */

/**
 * Result of server authentication attempt
 */
export type AuthenticationResult =
  | { kind: "authenticated"; serverId: number }
  | { kind: "unauthorized" }

/**
 * Constants for server creation
 */
export const INGRESS_CONSTANTS = {
  /** Default server configuration values */
  SERVER_DEFAULTS: {
    rconPassword: "",
    sortOrder: 0,
    activePlayers: 0,
    maxPlayers: 0,
  },
} as const
