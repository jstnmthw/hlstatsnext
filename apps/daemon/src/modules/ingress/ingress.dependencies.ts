/**
 * Ingress Dependencies
 *
 * Minimal interfaces for IngressService dependencies, following Interface Segregation Principle.
 */

import type { GameDetectionResult } from "@/modules/game/game-detection.types"
import type { ServerStateManager } from "@/modules/server/state/server-state-manager"
import type { IClock } from "@/shared/infrastructure/time/clock.interface"
import type { TokenServerAuthenticator } from "./adapters/token-server-authenticator"

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
  readonly tokenAuthenticator: TokenServerAuthenticator
  readonly gameDetector: IGameDetector
  readonly serverInfoProvider: IServerInfoProvider
  readonly serverStateManager: ServerStateManager
  readonly clock: IClock
}
