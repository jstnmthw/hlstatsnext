/**
 * Ingress Dependencies Factory
 *
 * Creates and wires ingress dependencies from existing services.
 */
import type { DatabaseClient } from "@/database/client"
import type { IGameDetectionService } from "@/modules/game/game-detection.types"
import { ServerOrchestrator } from "@/modules/server/orchestrators/server-orchestrator"
import type { IServerService } from "@/modules/server/server.types"
import type { ServerStateManager } from "@/modules/server/state/server-state-manager"
import type { IEventBus } from "@/shared/infrastructure/messaging/event-bus/event-bus.types"
import type { IClock } from "@/shared/infrastructure/time/clock.interface"
import type { ILogger } from "@/shared/utils/logger.types"
import { GameDetectorAdapter } from "../adapters/game-detector-adapter"
import { TokenServerAuthenticator } from "../adapters/token-server-authenticator"
import type { IngressDependencies } from "../ingress.dependencies"
import { PrismaTokenRepository } from "../repositories"

/**
 * Create ingress dependencies from existing services
 */
export function createIngressDependencies(
  database: DatabaseClient,
  serverService: IServerService,
  gameDetectionService: IGameDetectionService,
  serverStateManager: ServerStateManager,
  logger: ILogger,
  clock: IClock,
  eventBus: IEventBus,
): IngressDependencies {
  const serverOrchestrator = new ServerOrchestrator(database, serverService, logger)
  const tokenRepository = new PrismaTokenRepository(database, logger)

  return {
    tokenAuthenticator: new TokenServerAuthenticator(database, tokenRepository, logger, eventBus),
    gameDetector: new GameDetectorAdapter(gameDetectionService),
    serverInfoProvider: serverOrchestrator,
    serverStateManager,
    clock,
  }
}
