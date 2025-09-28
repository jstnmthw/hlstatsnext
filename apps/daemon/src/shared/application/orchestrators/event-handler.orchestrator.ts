/**
 * Event Handler Orchestrator
 *
 * Manages the creation of event handlers and module registry setup
 * with proper event type registration.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import type { BusinessServiceCollection } from "./business-service.orchestrator"

import { PlayerEventHandler } from "@/modules/player/events/player.events"
import { WeaponEventHandler } from "@/modules/weapon/weapon.events"
import { MatchEventHandler } from "@/modules/match/match.events"
import { ActionEventHandler } from "@/modules/action/action.events"
import { ServerEventHandler } from "@/modules/server/server.events"
import { ModuleRegistry } from "@/shared/infrastructure/modules/registry"
import { EventMetrics } from "@/shared/infrastructure/observability/event-metrics"
import { EventType } from "@/shared/types/events"

export interface EventHandlerCollection {
  playerEventHandler: PlayerEventHandler
  weaponEventHandler: WeaponEventHandler
  matchEventHandler: MatchEventHandler
  actionEventHandler: ActionEventHandler
  serverEventHandler: ServerEventHandler
  moduleRegistry: ModuleRegistry
  eventMetrics: EventMetrics
}

/**
 * Creates all event handlers and configures module registry
 *
 * @param services - Collection of business service instances
 * @param logger - Logger instance
 * @returns Collection of event handlers and configured module registry
 */
export function createEventHandlers(
  services: BusinessServiceCollection,
  logger: ILogger,
): EventHandlerCollection {
  const eventMetrics = new EventMetrics(logger)

  const eventHandlers = createHandlerInstances(services, logger, eventMetrics)
  const moduleRegistry = createModuleRegistry(eventHandlers, logger)

  return {
    ...eventHandlers,
    moduleRegistry,
    eventMetrics,
  }
}

/**
 * Creates individual event handler instances
 */
function createHandlerInstances(
  services: BusinessServiceCollection,
  logger: ILogger,
  eventMetrics: EventMetrics,
) {
  const playerEventHandler = new PlayerEventHandler(
    logger,
    services.playerService,
    services.serverService,
    eventMetrics,
  )

  const weaponEventHandler = new WeaponEventHandler(logger, services.weaponService, eventMetrics)

  const matchEventHandler = new MatchEventHandler(
    logger,
    services.matchService,
    services.actionService,
    services.playerService,
    eventMetrics,
  )

  const actionEventHandler = new ActionEventHandler(
    logger,
    services.actionService,
    services.sessionService,
    services.matchService,
    eventMetrics,
  )

  const serverEventHandler = new ServerEventHandler(logger, eventMetrics)

  return {
    playerEventHandler,
    weaponEventHandler,
    matchEventHandler,
    actionEventHandler,
    serverEventHandler,
  }
}

/**
 * Creates and configures module registry with event type mappings
 */
function createModuleRegistry(
  handlers: ReturnType<typeof createHandlerInstances>,
  logger: ILogger,
): ModuleRegistry {
  const moduleRegistry = new ModuleRegistry(logger)

  registerPlayerModule(moduleRegistry, handlers.playerEventHandler)
  registerWeaponModule(moduleRegistry, handlers.weaponEventHandler)
  registerMatchModule(moduleRegistry, handlers.matchEventHandler)
  registerActionModule(moduleRegistry, handlers.actionEventHandler)
  registerServerModule(moduleRegistry, handlers.serverEventHandler)

  return moduleRegistry
}

/**
 * Registers player module with its handled event types
 */
function registerPlayerModule(registry: ModuleRegistry, handler: PlayerEventHandler): void {
  registry.register({
    name: "player",
    handler,
    handledEvents: [
      EventType.PLAYER_CONNECT,
      EventType.PLAYER_DISCONNECT,
      EventType.PLAYER_ENTRY,
      EventType.PLAYER_CHANGE_TEAM,
      EventType.PLAYER_CHANGE_NAME,
      EventType.CHAT_MESSAGE,
      EventType.PLAYER_KILL,
      EventType.PLAYER_SUICIDE,
      EventType.PLAYER_DAMAGE,
      EventType.PLAYER_TEAMKILL,
    ],
  })
}

/**
 * Registers weapon module with its handled event types
 */
function registerWeaponModule(registry: ModuleRegistry, handler: WeaponEventHandler): void {
  registry.register({
    name: "weapon",
    handler,
    handledEvents: [
      EventType.WEAPON_FIRE,
      EventType.WEAPON_HIT,
      EventType.PLAYER_KILL, // For weapon statistics
    ],
  })
}

/**
 * Registers match module with its handled event types
 */
function registerMatchModule(registry: ModuleRegistry, handler: MatchEventHandler): void {
  registry.register({
    name: "match",
    handler,
    handledEvents: [
      EventType.ROUND_START,
      EventType.ROUND_END,
      EventType.TEAM_WIN,
      EventType.MAP_CHANGE,
      EventType.PLAYER_KILL, // For match statistics
    ],
  })
}

/**
 * Registers action module with its handled event types
 */
function registerActionModule(registry: ModuleRegistry, handler: ActionEventHandler): void {
  registry.register({
    name: "action",
    handler,
    handledEvents: [
      EventType.ACTION_PLAYER,
      EventType.ACTION_PLAYER_PLAYER,
      EventType.ACTION_TEAM,
      EventType.ACTION_WORLD,
    ],
  })
}

/**
 * Registers server module with its handled event types
 */
function registerServerModule(registry: ModuleRegistry, handler: ServerEventHandler): void {
  registry.register({
    name: "server",
    handler,
    handledEvents: [],
  })
}
