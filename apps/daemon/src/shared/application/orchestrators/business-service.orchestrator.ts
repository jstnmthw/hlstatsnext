/**
 * Business Service Orchestrator
 *
 * Handles the creation and dependency wiring of all business services
 * with proper dependency order resolution.
 */

import type { DatabaseClient } from "@/database/client"
import type { ScheduleConfig } from "@/modules/rcon/types/schedule.types"
import type { RconConfig } from "@/shared/application/factories/rcon-config.factory"
import type { ILogger } from "@/shared/utils/logger.types"
import type { RepositoryCollection } from "./repository.orchestrator"

import { ActionService } from "@/modules/action/action.service"
import type { IActionService } from "@/modules/action/action.types"
import { GameDetectionService } from "@/modules/game/game-detection.service"
import type { IGameDetectionService } from "@/modules/game/game-detection.types"
import { GeoIPService } from "@/modules/geoip/geoip.service"
import type { IMapService } from "@/modules/map/map.service"
import { MapService } from "@/modules/map/map.service"
import { MatchService } from "@/modules/match/match.service"
import type { IMatchService } from "@/modules/match/match.types"
import { PlayerStatusEnricher } from "@/modules/player/enrichers/player-status-enricher"
import { PlayerSessionRepository } from "@/modules/player/repositories/player-session.repository"
import { PlayerSessionService } from "@/modules/player/services/player-session.service"
import { PlayerService } from "@/modules/player/services/player.service"
import { SimplePlayerResolverService } from "@/modules/player/services/simple-player-resolver.service"
import type { IPlayerSessionService } from "@/modules/player/types/player-session.types"
import type { IPlayerService } from "@/modules/player/types/player.types"
import { RankingService } from "@/modules/ranking/ranking.service"
import type { IRankingService } from "@/modules/ranking/ranking.types"
import { NotificationConfigRepository } from "@/modules/rcon/repositories/notification-config.repository"
import { RconScheduleService } from "@/modules/rcon/schedulers/rcon-schedule.service"
import { CommandResolverService } from "@/modules/rcon/services/command-resolver.service"
import { EventNotificationService } from "@/modules/rcon/services/event-notification.service"
import { PlayerNotificationService } from "@/modules/rcon/services/player-notification.service"
import { RconCommandService } from "@/modules/rcon/services/rcon-command.service"
import { RconService } from "@/modules/rcon/services/rcon.service"
import type { IRconService } from "@/modules/rcon/types/rcon.types"
import type { IRconScheduleService } from "@/modules/rcon/types/schedule.types"
import type { IServerStatusEnricher } from "@/modules/server/enrichers/server-status-enricher"
import { ServerStatusEnricher } from "@/modules/server/enrichers/server-status-enricher"
import { ServerService } from "@/modules/server/server.service"
import type { IServerService } from "@/modules/server/server.types"
import { WeaponService } from "@/modules/weapon/weapon.service"
import type { IWeaponService } from "@/modules/weapon/weapon.types"
import type { IEventBus } from "@/shared/infrastructure/messaging/event-bus/event-bus.types"

export interface BusinessServiceCollection {
  playerService: IPlayerService
  matchService: IMatchService
  mapService: IMapService
  weaponService: IWeaponService
  rankingService: IRankingService
  actionService: IActionService
  gameDetectionService: IGameDetectionService
  serverService: IServerService
  rconService: IRconService
  rconScheduleService: IRconScheduleService
  serverStatusEnricher: IServerStatusEnricher
  sessionService: IPlayerSessionService
  commandResolverService: CommandResolverService
}

/**
 * Creates all business services with proper dependency wiring
 *
 * Services are created in dependency order to ensure all dependencies
 * are available when needed.
 *
 * @param repositories - Collection of repository instances
 * @param database - Database client instance
 * @param logger - Logger instance
 * @param rconConfig - RCON configuration
 * @param scheduleConfig - RCON schedule configuration
 * @returns Collection of all business service instances
 */
export function createBusinessServices(
  repositories: RepositoryCollection,
  database: DatabaseClient,
  logger: ILogger,
  rconConfig: RconConfig,
  scheduleConfig: ScheduleConfig,
  eventBus: IEventBus,
): BusinessServiceCollection {
  // First tier - services with minimal dependencies
  const rankingService = new RankingService(logger, repositories.weaponRepository, database.prisma)
  const geoipService = new GeoIPService(database, logger)
  const weaponService = new WeaponService(repositories.weaponRepository, logger)
  const gameDetectionService = new GameDetectionService(logger)
  const serverService = new ServerService(repositories.serverRepository, logger)

  // Second tier - RCON base services
  const rconService = new RconService(repositories.rconRepository, logger, rconConfig)
  const commandResolverService = new CommandResolverService(repositories.serverRepository, logger)

  // Create map service as single source of truth for maps
  const mapService = new MapService(rconService, repositories.matchRepository, logger)

  // Create match service with map service dependency
  const matchService = new MatchService(repositories.matchRepository, logger, mapService)

  // Session management services
  const sessionRepository = new PlayerSessionRepository(logger)
  const simplePlayerResolver = new SimplePlayerResolverService(
    repositories.playerRepository,
    logger,
  )

  // Session management services - create first since PlayerService needs it
  const sessionService = new PlayerSessionService(
    sessionRepository,
    rconService,
    serverService,
    simplePlayerResolver,
    repositories.playerRepository,
    logger,
  )

  // RCON command services
  const rconCommandService = new RconCommandService(
    rconService,
    commandResolverService,
    sessionService,
    logger,
  )
  const playerNotificationService = new PlayerNotificationService(
    rconCommandService,
    commandResolverService,
    sessionService,
    logger,
  )

  // Create notification config repository and event notification service
  const notificationConfigRepository = new NotificationConfigRepository(database.prisma, logger)
  const eventNotificationService = new EventNotificationService(
    playerNotificationService,
    notificationConfigRepository,
    commandResolverService,
    logger,
  )

  // Now create PlayerService with all dependencies properly injected
  const playerService = new PlayerService(
    repositories.playerRepository,
    logger,
    rankingService,
    repositories.serverRepository,
    serverService,
    sessionService,
    matchService,
    mapService,
    geoipService,
    eventNotificationService,
  )

  // Fourth tier - services dependent on third tier
  const actionService = new ActionService(
    repositories.actionRepository,
    logger,
    playerService,
    matchService,
    eventNotificationService,
    mapService,
  )

  // Fifth tier - enrichers dependent on multiple services
  const playerStatusEnricher = new PlayerStatusEnricher(
    repositories.playerRepository,
    serverService,
    geoipService,
    logger,
  )

  const serverStatusEnricher = new ServerStatusEnricher(
    rconService,
    repositories.serverRepository,
    serverService,
    logger,
    playerStatusEnricher,
  )

  // Sixth tier - RCON scheduler service dependent on RCON and server services
  const rconScheduleService = new RconScheduleService(
    logger,
    rconService,
    serverService,
    scheduleConfig,
    eventBus,
    serverStatusEnricher,
    sessionService,
  )

  return {
    playerService,
    matchService,
    mapService,
    weaponService,
    rankingService,
    actionService,
    gameDetectionService,
    serverService,
    rconService,
    rconScheduleService,
    serverStatusEnricher,
    sessionService,
    commandResolverService,
  }
}
