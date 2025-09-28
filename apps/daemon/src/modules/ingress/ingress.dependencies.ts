/**
 * Ingress Dependencies
 *
 * Minimal interfaces for IngressService dependencies, following Interface Segregation Principle.
 */

import type { GameDetectionResult } from "@/modules/game/game-detection.types"
import type { IClock } from "@/shared/infrastructure/time/clock.interface"
import type { ServerStateManager } from "@/modules/server/state/server-state-manager"

/**
 * Server authentication service interface
 */
export interface IServerAuthenticator {
  /**
   * Authenticate a server by address and port
   * @returns Server ID if authenticated, null otherwise
   */
  authenticateServer(address: string, port: number): Promise<number | null>

  /**
   * Cache a server ID for a given address and port
   */
  cacheServer(address: string, port: number, serverId: number): Promise<void>

  /**
   * Get currently authenticated server IDs
   * Useful for RCON monitoring to discover active servers
   */
  getAuthenticatedServerIds(): number[]
}

/**
 * Game detection service interface for ingress
 */
export interface IGameDetector {
  /**
   * Detect game type from server information
   */
  detectGame(address: string, port: number, logSamples: string[]): Promise<GameDetectionResult>
}

/**
 * Server information provider for ingress
 */
export interface IServerInfoProvider {
  /**
   * Get the game type for a specific server
   */
  getServerGame(serverId: number): Promise<string>

  /**
   * Find or create a server in development mode
   */
  findOrCreateServer(address: string, port: number, gameCode: string): Promise<{ serverId: number }>
}

/**
 * Minimal dependencies required by IngressService
 */
export interface IngressDependencies {
  readonly serverAuthenticator: IServerAuthenticator
  readonly gameDetector: IGameDetector
  readonly serverInfoProvider: IServerInfoProvider
  readonly serverStateManager: ServerStateManager
  readonly clock: IClock
}
