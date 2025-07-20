/**
 * Application Context - Dependency Injection Container
 * 
 * Central location for all service instantiation and dependency wiring.
 */

import { DatabaseClient } from '@/database/client'
import { createLogger } from '@/shared/utils/logger'
import type { ILogger } from '@/shared/utils/logger'

// Module imports
import { PlayerRepository } from '@/modules/player/player.repository'
import { PlayerService } from '@/modules/player/player.service'
import type { IPlayerService } from '@/modules/player/player.types'

import { MatchRepository } from '@/modules/match/match.repository'
import { MatchService } from '@/modules/match/match.service'
import type { IMatchService } from '@/modules/match/match.types'

import { WeaponRepository } from '@/modules/weapon/weapon.repository'
import { WeaponService } from '@/modules/weapon/weapon.service'
import type { IWeaponService } from '@/modules/weapon/weapon.types'

import { RankingService } from '@/modules/ranking/ranking.service'
import type { IRankingService } from '@/modules/ranking/ranking.types'

import { ActionService } from '@/modules/action/action.service'
import type { IActionService } from '@/modules/action/action.types'

import { IngressService } from '@/modules/ingress/ingress.service'
import type { IIngressService, IngressOptions } from '@/modules/ingress/ingress.types'

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
}

export function createAppContext(ingressOptions?: IngressOptions): AppContext {
  // Infrastructure
  const database = new DatabaseClient()
  const logger = createLogger()
  
  // Repositories
  const playerRepository = new PlayerRepository(database, logger)
  const matchRepository = new MatchRepository(database, logger)
  const weaponRepository = new WeaponRepository(database, logger)
  
  // Services
  const playerService = new PlayerService(playerRepository, logger)
  const matchService = new MatchService(matchRepository, logger)
  const weaponService = new WeaponService(weaponRepository, logger)
  const rankingService = new RankingService(logger)
  const actionService = new ActionService(logger)
  
  // Create context object for circular dependency resolution  
  const context = {
    database,
    logger,
    playerService,
    matchService,
    weaponService,
    rankingService,
    actionService,
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