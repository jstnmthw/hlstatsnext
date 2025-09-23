/**
 * Application Context - Dependency Injection Container
 *
 * Central location for all service instantiation and dependency wiring.
 */

import type { EventCoordinator } from "@/shared/application/event-coordinator"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IEventPublisher } from "@/shared/infrastructure/messaging/queue/core/types"
import type { IEventBus } from "@/shared/infrastructure/messaging/event-bus/event-bus.types"
import type { IngressOptions } from "@/modules/ingress/ingress.types"
import type { IPlayerService } from "@/modules/player/player.types"
import type { IPlayerSessionService } from "@/modules/player/types/player-session.types"
import type { IMatchService } from "@/modules/match/match.types"
import type { IWeaponService } from "@/modules/weapon/weapon.types"
import type { IRankingService } from "@/modules/ranking/ranking.types"
import type { IActionService } from "@/modules/action/action.types"
import type { IIngressService } from "@/modules/ingress/ingress.types"
import type { IGameDetectionService } from "@/modules/game/game-detection.types"
import type { IServerService } from "@/modules/server/server.types"
import type { IRconService } from "@/modules/rcon/types/rcon.types"
import type { IRconScheduleService } from "@/modules/rcon/types/schedule.types"
import type { CommandResolverService } from "@/modules/rcon/services/command-resolver.service"
import type { IServerStatusEnricher } from "@/modules/server/enrichers/server-status-enricher"
import type { IPlayerRepository } from "@/modules/player/player.types"

import { DatabaseClient } from "@/database/client"
import { QueueModule } from "@/shared/infrastructure/messaging/module"
import { IngressService } from "@/modules/ingress/ingress.service"
import { EventBus } from "@/shared/infrastructure/messaging/event-bus/event-bus"
import { PlayerEventHandler } from "@/modules/player/player.events"
import { systemClock } from "@/shared/infrastructure/time"
import { WeaponEventHandler } from "@/modules/weapon/weapon.events"
import { MatchEventHandler } from "@/modules/match/match.events"
import { ActionEventHandler } from "@/modules/action/action.events"
import { ServerEventHandler } from "@/modules/server/server.events"
import { ModuleRegistry } from "@/shared/infrastructure/modules/registry"
import { EventMetrics } from "@/shared/infrastructure/observability/event-metrics"
import { RabbitMQConsumer } from "@/shared/infrastructure/messaging/queue/rabbitmq/consumer"
import { createIngressDependencies } from "@/modules/ingress/factories/ingress-dependencies"
import { createInfrastructureComponents } from "@/shared/application/factories/infrastructure-config.factory"
import { createRconConfig } from "@/shared/application/factories/rcon-config.factory"
import { createIngressConfig } from "@/shared/application/factories/ingress-config.factory"
import { getScheduleConfig } from "@/modules/rcon/config/schedule.config"
import { createRepositories } from "@/shared/application/orchestrators/repository.orchestrator"
import { createBusinessServices } from "@/shared/application/orchestrators/business-service.orchestrator"
import { createEventHandlers } from "@/shared/application/orchestrators/event-handler.orchestrator"
import { createQueueModule } from "@/shared/infrastructure/factories/queue-module.factory"
import { SystemUuidService } from "@/shared/infrastructure/identifiers/system-uuid.service"
import { setUuidService } from "@/shared/infrastructure/messaging/queue/utils/message-utils"
import { PlayerCommandCoordinator } from "@/shared/application/coordinators/player-command.coordinator"

// Types
export interface AppContext {
  // Infrastructure
  database: DatabaseClient
  logger: ILogger
  eventBus: IEventBus

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
  rconService: IRconService
  rconScheduleService: IRconScheduleService
  serverStatusEnricher: IServerStatusEnricher
  sessionService: IPlayerSessionService
  commandResolverService: CommandResolverService

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

  // Repositories (for coordinators)
  repositories: {
    playerRepository: IPlayerRepository
  }
}

// Singleton instance for the application
let appContext: AppContext | null = null

/**
 * Create the application context
 * @param ingressOptions - Optional ingress options
 * @returns The application context
 */
export function createAppContext(ingressOptions?: IngressOptions): AppContext {
  // Create infrastructure components
  const infrastructure = createInfrastructureComponents()

  // Create EventBus for decoupled module communication
  const eventBus = new EventBus(infrastructure.logger)

  // Initialize UUID service for message ID generation (CRITICAL: must be done before parsers are used)
  setUuidService(new SystemUuidService(systemClock))
  infrastructure.logger.debug("UUID service initialized for message ID generation")

  // Create configuration objects
  const rconConfig = createRconConfig()
  const scheduleConfig = getScheduleConfig(process.env.NODE_ENV || "production")
  const resolvedIngressOptions = createIngressConfig(ingressOptions)

  // Create repositories
  const repositories = createRepositories(
    infrastructure.database,
    infrastructure.logger,
    infrastructure.crypto,
  )

  // Create business services
  const services = createBusinessServices(
    repositories,
    infrastructure.database,
    infrastructure.logger,
    rconConfig,
    scheduleConfig,
  )

  // Create queue module
  const queueResult = createQueueModule(infrastructure.logger)

  // Create ingress dependencies and service
  const ingressDependencies = createIngressDependencies(
    infrastructure.database,
    services.serverService,
    services.gameDetectionService,
    infrastructure.logger,
    systemClock,
    eventBus,
  )

  const ingressService = new IngressService(
    infrastructure.logger,
    ingressDependencies,
    resolvedIngressOptions,
  )

  // Create event handlers and module registry
  const eventComponents = createEventHandlers(services, infrastructure.logger)

  return {
    // Infrastructure
    database: infrastructure.database,
    logger: infrastructure.logger,
    eventBus,

    // Queue Infrastructure
    queueModule: queueResult.queueModule,
    eventPublisher: undefined, // Will be created during queue initialization
    rabbitmqConsumer: undefined, // Will be created during queue initialization

    // Business Services
    playerService: services.playerService,
    matchService: services.matchService,
    weaponService: services.weaponService,
    rankingService: services.rankingService,
    actionService: services.actionService,
    ingressService,
    gameDetectionService: services.gameDetectionService,
    serverService: services.serverService,
    rconService: services.rconService,
    rconScheduleService: services.rconScheduleService,
    serverStatusEnricher: services.serverStatusEnricher,
    sessionService: services.sessionService,
    commandResolverService: services.commandResolverService,

    // Event Handlers
    playerEventHandler: eventComponents.playerEventHandler,
    weaponEventHandler: eventComponents.weaponEventHandler,
    matchEventHandler: eventComponents.matchEventHandler,
    actionEventHandler: eventComponents.actionEventHandler,
    serverEventHandler: eventComponents.serverEventHandler,

    // Module Registry and Metrics
    moduleRegistry: eventComponents.moduleRegistry,
    eventMetrics: eventComponents.eventMetrics,

    // Repositories (for coordinators)
    repositories: {
      playerRepository: repositories.playerRepository,
    },
  }
}

/**
 * Get the application context
 * @param ingressOptions - Optional ingress options
 * @returns The application context
 */
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

    // Provide publisher to ingress explicitly
    context.ingressService.setPublisher(context.eventPublisher)

    // Start RabbitMQ consumer via queue module
    const coordinators: EventCoordinator[] = [
      new PlayerCommandCoordinator(
        context.repositories.playerRepository,
        context.rconService,
        context.commandResolverService,
        context.logger,
      ),
    ]
    await context.queueModule.startRabbitMQConsumer(context.moduleRegistry, coordinators)

    // Keep a reference for shutdown if needed
    context.rabbitmqConsumer = context.queueModule.getRabbitMQConsumer()

    context.logger.info(
      "Queue infrastructure initialized - queue-first publishing and RabbitMQ consumer enabled",
    )
  } catch (error) {
    context.logger.error(`Failed to initialize queue infrastructure: ${error}`)
    context.logger.warn("Queue unavailable; ingress will not publish until queue is available")

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

/**
 * Reset the application context to allow for a fresh start
 */
export function resetAppContext(): void {
  appContext = null
}
