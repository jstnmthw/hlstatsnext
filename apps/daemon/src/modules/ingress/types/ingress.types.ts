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
  | { kind: "dev-mode" }

/**
 * Constants for server authentication and creation
 */
export const INGRESS_CONSTANTS = {
  /** Default game for development mode servers */
  DEFAULT_DEV_GAME: "cstrike",
  /** Sentinel value indicating development mode authentication */
  DEV_AUTH_SENTINEL: -1,
  /** Default server configuration values */
  SERVER_DEFAULTS: {
    rconPassword: "",
    sortOrder: 0,
    activePlayers: 0,
    maxPlayers: 0,
  },
} as const
