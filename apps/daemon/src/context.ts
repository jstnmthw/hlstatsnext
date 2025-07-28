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
import {
  QueueModule,
  createDevelopmentRabbitMQConfig,
  DualEventPublisher,
} from "@/shared/infrastructure/queue"
import {
  EventBusAdapter,
  type IEventEmitter,
} from "@/shared/infrastructure/event-publisher-adapter"
import type { BaseEvent } from "@/shared/types/events"
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
import { ModuleRegistry } from "@/shared/infrastructure/module-registry"
import { EventMetrics } from "@/shared/infrastructure/event-metrics"
import { KillEventCoordinator, SagaEventCoordinator } from "@/shared/application/event-coordinator"
import { KillEventSaga } from "@/shared/application/sagas/kill-event/kill-event.saga"
import { SagaMonitor } from "@/shared/application/sagas/saga.monitor"

export interface AppContext {
  // Infrastructure
  database: DatabaseClient
  logger: ILogger
  eventBus: IEventBus

  // Queue Infrastructure (optional for migration)
  queueModule?: QueueModule
  dualPublisher?: DualEventPublisher

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

  // Create event bus
  const eventBus = new EventBus(logger)

  // Create queue module for RabbitMQ integration (optional)
  let queueModule: QueueModule | undefined
  let dualPublisher: DualEventPublisher | undefined

  try {
    const rabbitmqConfig = createDevelopmentRabbitMQConfig()
    queueModule = new QueueModule(
      {
        rabbitmq: rabbitmqConfig,
        autoStartConsumers: false, // We'll start consumers manually
        autoStartShadowConsumer: true, // Start shadow consumer for validation
        autoSetupTopology: true,
        dualPublisher: {
          enableQueue: true,
          enableEventBus: true,
          gracefulFallback: true,
          queueTimeout: 5000,
        },
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

  // Create event emitter adapter (start with EventBus)
  const eventEmitter: IEventEmitter = new EventBusAdapter(eventBus)

  // Create ingress service without circular dependency
  const ingressService = new IngressService(
    logger,
    eventEmitter,
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

  // Create event metrics and saga monitor
  const eventMetrics = new EventMetrics(logger)
  const sagaMonitor = new SagaMonitor(logger)

  // Create sagas
  const killEventSaga = new KillEventSaga(
    logger,
    eventBus,
    playerService,
    weaponService,
    matchService,
    rankingService,
    sagaMonitor,
  )

  // Create saga coordinator
  const sagaCoordinator = new SagaEventCoordinator(logger)
  sagaCoordinator.registerSaga(EventType.PLAYER_KILL, killEventSaga)

  // Keep the simple kill event coordinator for now (Phase 2 compatibility)
  const killEventCoordinator = new KillEventCoordinator(logger, rankingService)
  const coordinators = [sagaCoordinator, killEventCoordinator]
  const eventProcessor = new EventProcessor(eventBus, eventProcessorDeps, coordinators)

  // Create module event handlers with metrics
  const playerEventHandler = new PlayerEventHandler(
    eventBus,
    logger,
    playerService,
    serverService,
    eventMetrics,
  )

  const weaponEventHandler = new WeaponEventHandler(eventBus, logger, weaponService, eventMetrics)

  const matchEventHandler = new MatchEventHandler(eventBus, logger, matchService, eventMetrics)

  const actionEventHandler = new ActionEventHandler(eventBus, logger, actionService, eventMetrics)

  const serverEventHandler = new ServerEventHandler(eventBus, logger, serverService, eventMetrics)

  // Create module registry and register all handlers
  const moduleRegistry = new ModuleRegistry(logger)

  moduleRegistry.register({
    name: "player",
    handler: playerEventHandler,
    handledEvents: [
      EventType.PLAYER_CONNECT,
      EventType.PLAYER_DISCONNECT,
      EventType.PLAYER_CHANGE_NAME,
      EventType.CHAT_MESSAGE,
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
      EventType.SERVER_SHUTDOWN,
      EventType.SERVER_STATS_UPDATE,
      EventType.ADMIN_ACTION,
    ],
  })

  // Return complete context
  return {
    database,
    logger,
    eventBus,
    queueModule,
    dualPublisher,
    playerService,
    matchService,
    weaponService,
    rankingService,
    actionService,
    ingressService,
    gameDetectionService,
    serverService,
    eventProcessor,
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

    // Create dual publisher
    context.dualPublisher = context.queueModule.createDualPublisher(context.eventBus)

    // Replace the ingress service's event emitter with the dual publisher
    // This is a bit of a hack but necessary for the migration
    const ingressService = context.ingressService as unknown as {
      eventEmitter: IEventEmitter
    }

    // Create adapter for dual publisher
    const dualEventEmitter = {
      emit: async (event: BaseEvent) => {
        await context.dualPublisher!.publish(event)
      },
    }

    // Replace the event emitter
    Object.defineProperty(ingressService, "eventEmitter", {
      value: dualEventEmitter,
      writable: false,
    })

    context.logger.info("Queue infrastructure initialized - dual publishing enabled")
  } catch (error) {
    context.logger.error(`Failed to initialize queue infrastructure: ${error}`)
    context.logger.warn("Continuing with EventBus only")

    // Clean up failed queue module
    context.queueModule = undefined
    context.dualPublisher = undefined
  }
}

export function resetAppContext(): void {
  appContext = null
}
