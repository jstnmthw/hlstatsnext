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
import {
  QueueModule,
  createDevelopmentRabbitMQConfig,
} from "@/shared/infrastructure/messaging/module"
import type { IEventPublisher } from "@/shared/infrastructure/messaging/queue/core/types"
// Remove unused import - BaseEvent not needed in context
import { EventType } from "@/shared/types/events"

import { GameDetectionService } from "@/modules/game/game-detection.service"

import { ServerRepository } from "@/modules/server/server.repository"
import { ServerService } from "@/modules/server/server.service"
import type { IServerService } from "@/modules/server/server.types"
import { IGameDetectionService } from "./modules/game/game-detection.types"

import { PlayerEventHandler } from "@/modules/player/player.events"
import { WeaponEventHandler } from "@/modules/weapon/weapon.events"
import { MatchEventHandler } from "@/modules/match/match.events"
import { ActionEventHandler } from "@/modules/action/action.events"
import { ServerEventHandler } from "@/modules/server/server.events"
import { ModuleRegistry } from "@/shared/infrastructure/modules/registry"
import { EventMetrics } from "@/shared/infrastructure/observability/event-metrics"
import type { EventCoordinator } from "@/shared/application/event-coordinator"
import { RabbitMQConsumer } from "@/shared/infrastructure/messaging/queue/rabbitmq/consumer"

export interface AppContext {
  // Infrastructure
  database: DatabaseClient
  logger: ILogger

  // Queue Infrastructure (migration to queue-first)
  queueModule?: QueueModule
  eventPublisher?: IEventPublisher
  rabbitmqConsumer?: RabbitMQConsumer

  // Business Services
  playerService: IPlayerService
  matchService: IMatchService
  weaponService: IWeaponService
  rankingService: IRankingService
  actionService: IActionService
  ingressService: IIngressService
  gameDetectionService: IGameDetectionService
  serverService: IServerService

  // Module Event Handlers
  playerEventHandler: PlayerEventHandler
  weaponEventHandler: WeaponEventHandler
  matchEventHandler: MatchEventHandler
  actionEventHandler: ActionEventHandler
  serverEventHandler: ServerEventHandler

  // Module Registry
  moduleRegistry: ModuleRegistry

  // Performance Monitoring
  eventMetrics: EventMetrics
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

  // Create queue module for RabbitMQ integration (optional)
  let queueModule: QueueModule | undefined

  try {
    const rabbitmqConfig = createDevelopmentRabbitMQConfig()
    queueModule = new QueueModule(
      {
        rabbitmq: rabbitmqConfig,
        autoStartConsumers: false, // We'll start consumers manually
        autoStartShadowConsumer: true, // Start shadow consumer for validation
        autoSetupTopology: true,
        // dualPublisher config removed - migration complete
        shadowConsumer: {
          queues: ["hlstats.events.priority", "hlstats.events.standard", "hlstats.events.bulk"],
          metricsInterval: 30000, // Log metrics every 30 seconds
          logEvents: process.env.LOG_LEVEL === "debug",
          logParsingErrors: true, // Always log parsing errors
          logRawMessages: process.env.LOG_LEVEL === "debug",
          maxBufferSize: 10000,
        },
      },
      logger,
    )

    logger.info("Queue module created - will initialize during ingress service creation")
  } catch (error) {
    logger.warn(
      `Failed to create queue module: ${error instanceof Error ? error.message : String(error)}`,
    )
    logger.warn("Continuing with EventBus only")
  }

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

  // Initialize queue module and create dual publisher if available
  if (queueModule) {
    try {
      // Initialize queue module asynchronously - we'll handle this in an async wrapper
      logger.info("Queue module available - dual publisher will be created asynchronously")
    } catch (error) {
      logger.error(`Failed to initialize queue module: ${error}`)
      queueModule = undefined
    }
  }

  // Temporary: Create minimal event emitter for ingress (will be replaced with queue publisher)
  // Temporary placeholder - will be replaced with actual queue publisher
  const eventPublisher: IEventPublisher = {
    publish: async () => {
      throw new Error("EventBus removed - ingress service will use queue publisher")
    },
    publishBatch: async () => {
      throw new Error("EventBus removed - ingress service will use queue publisher")
    },
  }

  // Create ingress service without circular dependency
  const ingressService = new IngressService(
    logger,
    eventPublisher,
    ingressDependencies,
    ingressOptions,
  )

  // Create event metrics
  const eventMetrics = new EventMetrics(logger)

  // Create module event handlers (queue-only, no EventBus dependencies)
  const playerEventHandler = new PlayerEventHandler(
    logger,
    playerService,
    serverService,
    eventMetrics,
  )

  const weaponEventHandler = new WeaponEventHandler(logger, weaponService, eventMetrics)

  const matchEventHandler = new MatchEventHandler(logger, matchService, eventMetrics)

  const actionEventHandler = new ActionEventHandler(logger, actionService, eventMetrics)

  const serverEventHandler = new ServerEventHandler(logger, serverService, eventMetrics)

  // Create module registry and register all handlers (queue-only processing)
  const moduleRegistry = new ModuleRegistry(logger)

  moduleRegistry.register({
    name: "player",
    handler: playerEventHandler,
    handledEvents: [
      EventType.PLAYER_CONNECT,
      EventType.PLAYER_DISCONNECT,
      EventType.PLAYER_CHANGE_NAME,
      EventType.CHAT_MESSAGE,
      EventType.PLAYER_KILL,
      EventType.PLAYER_SUICIDE,
      EventType.PLAYER_DAMAGE,
      EventType.PLAYER_TEAMKILL,
    ],
  })

  moduleRegistry.register({
    name: "weapon",
    handler: weaponEventHandler,
    handledEvents: [
      EventType.WEAPON_FIRE,
      EventType.WEAPON_HIT,
      EventType.PLAYER_KILL, // For weapon statistics
    ],
  })

  moduleRegistry.register({
    name: "match",
    handler: matchEventHandler,
    handledEvents: [
      EventType.ROUND_START,
      EventType.ROUND_END,
      EventType.TEAM_WIN,
      EventType.MAP_CHANGE,
      EventType.BOMB_PLANT,
      EventType.BOMB_DEFUSE,
      EventType.BOMB_EXPLODE,
      EventType.HOSTAGE_RESCUE,
      EventType.HOSTAGE_TOUCH,
      EventType.FLAG_CAPTURE,
      EventType.FLAG_DEFEND,
      EventType.FLAG_PICKUP,
      EventType.FLAG_DROP,
      EventType.CONTROL_POINT_CAPTURE,
      EventType.CONTROL_POINT_DEFEND,
      EventType.PLAYER_KILL, // For match statistics
    ],
  })

  moduleRegistry.register({
    name: "action",
    handler: actionEventHandler,
    handledEvents: [
      EventType.ACTION_PLAYER,
      EventType.ACTION_PLAYER_PLAYER,
      EventType.ACTION_TEAM,
      EventType.ACTION_WORLD,
    ],
  })

  moduleRegistry.register({
    name: "server",
    handler: serverEventHandler,
    handledEvents: [
      // All server events migrated to queue-only processing (Phase 4):
      // - SERVER_SHUTDOWN: Now queue-only
      // - ADMIN_ACTION: Now queue-only
      // - SERVER_STATS_UPDATE: Already queue-only
    ],
  })

  // Return complete context
  return {
    database,
    logger,
    queueModule,
    eventPublisher: undefined, // Will be created during queue initialization
    rabbitmqConsumer: undefined, // Will be created during queue initialization
    playerService,
    matchService,
    weaponService,
    rankingService,
    actionService,
    ingressService,
    gameDetectionService,
    serverService,
    playerEventHandler,
    weaponEventHandler,
    matchEventHandler,
    actionEventHandler,
    serverEventHandler,
    moduleRegistry,
    eventMetrics,
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

/**
 * Initialize queue infrastructure and enable dual publishing
 * This should be called after the app context is created but before starting services
 */
export async function initializeQueueInfrastructure(context: AppContext): Promise<void> {
  if (!context.queueModule) {
    context.logger.info("No queue module available - skipping queue initialization")
    return
  }

  try {
    context.logger.info("Initializing queue infrastructure...")

    // Initialize the queue module first
    await context.queueModule.initialize()

    // Get the queue publisher directly (all events now queue-only)
    context.eventPublisher = context.queueModule.getPublisher()

    // No coordinators needed - module handlers handle all logic
    const coordinators: EventCoordinator[] = []

    context.rabbitmqConsumer = new RabbitMQConsumer(
      context.queueModule.getClient(),
      context.logger,
      context.moduleRegistry,
      coordinators,
    )

    // Start the RabbitMQ consumer
    await context.rabbitmqConsumer.start()

    // Replace the ingress service's event publisher with the actual queue publisher
    const ingressService = context.ingressService as unknown as {
      eventPublisher: IEventPublisher
    }

    // Replace the event publisher with the actual queue publisher
    Object.defineProperty(ingressService, "eventPublisher", {
      value: context.eventPublisher,
      writable: false,
    })

    context.logger.info(
      "Queue infrastructure initialized - queue-first publishing and RabbitMQ consumer enabled",
    )
  } catch (error) {
    context.logger.error(`Failed to initialize queue infrastructure: ${error}`)
    context.logger.warn("Continuing with EventBus only")

    // Clean up failed queue module
    if (context.rabbitmqConsumer) {
      try {
        await context.rabbitmqConsumer.stop()
      } catch (stopError) {
        context.logger.error(`Failed to stop RabbitMQ consumer during cleanup: ${stopError}`)
      }
      context.rabbitmqConsumer = undefined
    }
    context.queueModule = undefined
    context.eventPublisher = undefined
  }
}

export function resetAppContext(): void {
  appContext = null
}
