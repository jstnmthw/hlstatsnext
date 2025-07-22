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

import { GameDetectionService } from "@/modules/game/game-detection.service"

import { ServerRepository } from "@/modules/server/server.repository"
import { ServerService } from "@/modules/server/server.service"
import type { IServerService } from "@/modules/server/server.types"
import { IGameDetectionService } from "./modules/game/game-detection.types"

export interface AppContext {
  // Infrastructure
  database: DatabaseClient
  logger: ILogger

  // Business Services
  playerService: IPlayerService
  matchService: IMatchService
  weaponService: IWeaponService
  rankingService: IRankingService
  actionService: IActionService
  ingressService: IIngressService
  gameDetectionService: IGameDetectionService
  serverService: IServerService
}

export function createAppContext(ingressOptions?: IngressOptions): AppContext {
  // Infrastructure
  const database = new DatabaseClient()
  const logger = new Logger()

  // Repositories
  const playerRepository = new PlayerRepository(database, logger)
  const matchRepository = new MatchRepository(database, logger)
  const weaponRepository = new WeaponRepository(database, logger)
  const actionRepository = new ActionRepository(database)
  const serverRepository = new ServerRepository(database, logger)

  // Services (order matters for dependencies)
  const rankingService = new RankingService(logger, weaponRepository)
  const playerService = new PlayerService(playerRepository, logger, rankingService)
  const matchService = new MatchService(matchRepository, logger)
  const weaponService = new WeaponService(weaponRepository, logger)
  const actionService = new ActionService(actionRepository, logger, playerService)
  const gameDetectionService = new GameDetectionService(logger)
  const serverService = new ServerService(serverRepository, logger)

  // Create context object for circular dependency resolution
  const context = {
    database,
    logger,
    playerService,
    matchService,
    weaponService,
    rankingService,
    actionService,
    gameDetectionService,
    serverService,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ingressService: null as any, // Will be set below
  } as AppContext

  // Create ingress service with full context
  const ingressService = new IngressService(logger, database, context, ingressOptions)
  context.ingressService = ingressService

  return context
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
