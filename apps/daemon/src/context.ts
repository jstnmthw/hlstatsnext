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
          queues: ['hlstats.events.priority', 'hlstats.events.standard', 'hlstats.events.bulk'],
          metricsInterval: 30000, // Log metrics every 30 seconds
          logEvents: process.env.LOG_LEVEL === 'debug',
          logParsingErrors: true, // Always log parsing errors
          logRawMessages: process.env.LOG_LEVEL === 'debug',
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

  const eventProcessor = new EventProcessor(eventBus, eventProcessorDeps)

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
