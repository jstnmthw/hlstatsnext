/**
 * Application Context - Dependency Injection Container
 *
 * Central location for all service instantiation and dependency wiring.
 */

import { DatabaseClient } from "@/database/client"
import Logger from "@/shared/utils/logger"
import type { ILogger } from "@/shared/utils/logger.types"

// Module imports
import { PlayerRepository } from "@/modules/player/player.repository"
import { PlayerService } from "@/modules/player/player.service"
import type { IPlayerService } from "@/modules/player/player.types"

import { MatchRepository } from "@/modules/match/match.repository"
import { MatchService } from "@/modules/match/match.service"
import type { IMatchService } from "@/modules/match/match.types"

import { WeaponRepository } from "@/modules/weapon/weapon.repository"
import { WeaponService } from "@/modules/weapon/weapon.service"
import type { IWeaponService } from "@/modules/weapon/weapon.types"

import { RankingService } from "@/modules/ranking/ranking.service"
import type { IRankingService } from "@/modules/ranking/ranking.types"

import { ActionRepository } from "@/modules/action/action.repository"
import { ActionService } from "@/modules/action/action.service"
import type { IActionService } from "@/modules/action/action.types"

import { IngressService } from "@/modules/ingress/ingress.service"
import type { IIngressService, IngressOptions } from "@/modules/ingress/ingress.types"
import { createIngressDependencies } from "@/modules/ingress/ingress.adapter"
import { EventBus } from "@/shared/infrastructure/event-bus/event-bus"
import type { IEventBus } from "@/shared/infrastructure/event-bus/event-bus.types"
import { EventProcessor } from "@/shared/infrastructure/event-processor"
import type { EventProcessorDependencies } from "@/shared/infrastructure/event-processor"

import { GameDetectionService } from "@/modules/game/game-detection.service"

import { ServerRepository } from "@/modules/server/server.repository"
import { ServerService } from "@/modules/server/server.service"
import type { IServerService } from "@/modules/server/server.types"
import { IGameDetectionService } from "./modules/game/game-detection.types"

export interface AppContext {
  // Infrastructure
  database: DatabaseClient
  logger: ILogger
  eventBus: IEventBus

  // Business Services
  playerService: IPlayerService
  matchService: IMatchService
  weaponService: IWeaponService
  rankingService: IRankingService
  actionService: IActionService
  ingressService: IIngressService
  gameDetectionService: IGameDetectionService
  serverService: IServerService
  
  // Event Processing
  eventProcessor: EventProcessor
}

export function createAppContext(ingressOptions?: IngressOptions): AppContext {
  // Infrastructure
  const database = new DatabaseClient()
  const logger = new Logger()

  // Repositories
  const playerRepository = new PlayerRepository(database, logger)
  const matchRepository = new MatchRepository(database, logger)
  const weaponRepository = new WeaponRepository(database, logger)
  const actionRepository = new ActionRepository(database, logger)
  const serverRepository = new ServerRepository(database, logger)

  // Create event bus
  const eventBus = new EventBus(logger)

  // Services (order matters for dependencies)
  const rankingService = new RankingService(logger, weaponRepository)
  const matchService = new MatchService(matchRepository, logger)
  const playerService = new PlayerService(playerRepository, logger, rankingService, matchService)
  const weaponService = new WeaponService(weaponRepository, logger)
  const actionService = new ActionService(actionRepository, logger, playerService, matchService)
  const gameDetectionService = new GameDetectionService(logger)
  const serverService = new ServerService(serverRepository, logger)

  // Create ingress dependencies adapter
  const ingressDependencies = createIngressDependencies(
    database,
    serverService,
    gameDetectionService,
    logger,
    { skipAuth: ingressOptions?.skipAuth },
  )

  // Create ingress service without circular dependency
  const ingressService = new IngressService(
    logger,
    eventBus,
    ingressDependencies,
    ingressOptions,
  )

  // Create event processor with its dependencies
  const eventProcessorDeps: EventProcessorDependencies = {
    playerService,
    matchService,
    weaponService,
    rankingService,
    actionService,
    serverService,
    logger,
  }

  const eventProcessor = new EventProcessor(eventBus, eventProcessorDeps)

  // Return complete context
  return {
    database,
    logger,
    eventBus,
    playerService,
    matchService,
    weaponService,
    rankingService,
    actionService,
    ingressService,
    gameDetectionService,
    serverService,
    eventProcessor,
  }
}

// Singleton instance for the application
let appContext: AppContext | null = null

export function getAppContext(ingressOptions?: IngressOptions): AppContext {
  if (!appContext) {
    appContext = createAppContext(ingressOptions)
  }
  return appContext
}

export function resetAppContext(): void {
  appContext = null
}
