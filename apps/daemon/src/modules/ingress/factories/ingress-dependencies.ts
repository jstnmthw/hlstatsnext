/**
 * Ingress Dependencies Factory
 *
 * Creates and wires ingress dependencies from existing services.
 */
import type { IngressDependencies } from "../ingress.dependencies"
import type { DatabaseClient } from "@/database/client"
import type { IServerService } from "@/modules/server/server.types"
import type { IGameDetectionService } from "@/modules/game/game-detection.types"
import type { ILogger } from "@/shared/utils/logger.types"
import { DatabaseServerAuthenticator } from "../adapters/database-server-authenticator"
import { GameDetectorAdapter } from "../adapters/game-detector-adapter"
import { ServerOrchestrator } from "@/modules/server/orchestrators/server-orchestrator"

/**
 * Create ingress dependencies from existing services
 */
export function createIngressDependencies(
  database: DatabaseClient,
  serverService: IServerService,
  gameDetectionService: IGameDetectionService,
  logger: ILogger,
  options: { skipAuth?: boolean } = {},
): IngressDependencies {
  const serverOrchestrator = new ServerOrchestrator(database, serverService, logger)

  return {
    serverAuthenticator: new DatabaseServerAuthenticator(
      database,
      logger,
      options.skipAuth ?? false,
    ),
    gameDetector: new GameDetectorAdapter(gameDetectionService),
    serverInfoProvider: serverOrchestrator,
  }
}
