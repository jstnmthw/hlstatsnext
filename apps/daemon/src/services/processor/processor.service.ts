/*
  EventProcessorService
  ---------------------
  Consumes raw events from the ingress queue, validates them, and stores them
  using the database package. At this stage it only exposes an enqueue method.
*/

import { EventEmitter } from "events"
import { EventType } from "@/types/common/events"
import { MatchHandler } from "@/services/processor/handlers/match.handler"
import { EventService } from "@/services/event/event.service"
import { PlayerHandler } from "@/services/processor/handlers/player.handler"
import { WeaponHandler } from "@/services/processor/handlers/weapon.handler"
import { WeaponService } from "@/services/weapon/weapon.service"
import { PlayerService } from "@/services/player/player.service"
import { RankingHandler } from "@/services/processor/handlers/ranking.handler"
import { logger as defaultLogger } from "@/utils/logger"
import { DatabaseClient, databaseClient } from "@/database/client"

import type { GameEvent } from "@/types/common/events"
import type { IEventProcessor } from "@/services/processor/processor.types"
import type { IEventService } from "@/services/event/event.types"
import type { IPlayerHandler } from "@/services/processor/handlers/player.handler.types"
import type { IWeaponHandler } from "@/services/processor/handlers/weapon.handler.types"
import type { IMatchHandler } from "@/services/processor/handlers/match.handler.types"
import type { IRankingHandler } from "@/services/processor/handlers/ranking.handler.types"
import type { IPlayerService } from "@/services/player/player.types"
import type { ILogger } from "@/utils/logger.types"

export class EventProcessorService extends EventEmitter implements IEventProcessor {
  private readonly opts: { logBots?: boolean }

  // Game and configuration constants
  private readonly DEFAULT_GAME_ID = "csgo"
  private readonly DEFAULT_TOP_PLAYERS_LIMIT = 50

  constructor(
    private readonly eventService: IEventService,
    private readonly playerService: IPlayerService,
    private readonly playerHandler: IPlayerHandler,
    private readonly weaponHandler: IWeaponHandler,
    private readonly matchHandler: IMatchHandler,
    private readonly rankingHandler: IRankingHandler,
    private readonly logger: ILogger,
    opts: { logBots?: boolean } = {},
  ) {
    super()
    this.opts = { logBots: true, ...opts }
  }

  /* Existing enqueue placeholder (kept for API compatibility).
   * IDEALLY this will be removed in a later refactor when queueing lands. */
  async enqueue(): Promise<void> {
    this.logger.info("Event enqueued for processing")
  }

  /**
   * Process an event from the ingress queue.
   *
   * @param event - The event to process
   * @returns A promise that resolves when the event has been processed
   */
  async processEvent(event: GameEvent): Promise<void> {
    try {
      // Skip bot events if logBots is false
      if (!this.opts.logBots) {
        const eventWithMeta = event as GameEvent & { meta?: { isBot?: boolean } }
        if (eventWithMeta.meta?.isBot) {
          this.logger.debug(`Skipping bot event: ${event.eventType}`)
          return
        }
      }

      // Resolve player IDs for events that need them
      await this.resolvePlayerIds(event)

      // Persist the event to the database
      await this.eventService.createGameEvent(event)

      // Route to appropriate handlers
      switch (event.eventType) {
        case EventType.PLAYER_CONNECT:
        case EventType.PLAYER_DISCONNECT:
        case EventType.PLAYER_ENTRY:
        case EventType.PLAYER_CHANGE_TEAM:
        case EventType.PLAYER_CHANGE_ROLE:
        case EventType.PLAYER_CHANGE_NAME:
        case EventType.PLAYER_KILL:
        case EventType.PLAYER_SUICIDE:
        case EventType.PLAYER_TEAMKILL:
          await this.playerHandler.handleEvent(event)
          if (event.eventType === EventType.PLAYER_KILL) {
            await this.weaponHandler.handleEvent(event)
            await this.rankingHandler.handleEvent(event)
          }
          break

        case EventType.ROUND_START:
        case EventType.ROUND_END:
        case EventType.TEAM_WIN:
        case EventType.MAP_CHANGE:
          await this.matchHandler.handleEvent(event)
          break

        case EventType.CHAT_MESSAGE: {
          const chatData = event.data as { message: string; isDead: boolean }
          const deadIndicator = chatData.isDead ? " (dead)" : ""
          this.logger.chat(`${event.meta?.playerName}: ${chatData.message}${deadIndicator}`)
          break
        }

        default:
          this.logger.warn(`Unhandled event type: ${event.eventType}`)
          break
      }

      this.emit("eventProcessed", { success: true, event })
    } catch (error) {
      this.logger.failed(
        "Failed to process event",
        error instanceof Error ? error.message : String(error),
      )
      this.emit("eventProcessed", {
        success: false,
        event,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Resolve player IDs from Steam IDs for events that need them.
   *
   * @param event - The event to process
   */
  private async resolvePlayerIds(event: GameEvent): Promise<void> {
    switch (event.eventType) {
      case EventType.PLAYER_CONNECT: {
        if (!event.meta) {
          throw new Error("CONNECT event missing meta")
        }

        const { steamId, playerName } = event.meta
        const playerId = await this.playerService.getOrCreatePlayer(
          steamId,
          playerName,
          this.DEFAULT_GAME_ID,
        )
        event.data.playerId = playerId
        break
      }

      case EventType.PLAYER_DISCONNECT: {
        // For disconnect, we'd need to look up by Steam ID if we had it
        // For now, assume playerId is already set or will be resolved elsewhere
        break
      }

      case EventType.PLAYER_KILL:
      case EventType.PLAYER_TEAMKILL: {
        if (!event.meta) {
          throw new Error(`${event.eventType} event missing meta`)
        }

        const { killer, victim } = event.meta
        const killerId = await this.playerService.getOrCreatePlayer(
          killer.steamId,
          killer.playerName,
          this.DEFAULT_GAME_ID,
        )
        const victimId = await this.playerService.getOrCreatePlayer(
          victim.steamId,
          victim.playerName,
          this.DEFAULT_GAME_ID,
        )

        event.data.killerId = killerId
        event.data.victimId = victimId
        break
      }

      case EventType.PLAYER_SUICIDE: {
        if (!event.meta) {
          throw new Error("SUICIDE event missing meta")
        }

        const { steamId, playerName } = event.meta
        const playerId = await this.playerService.getOrCreatePlayer(
          steamId,
          playerName,
          this.DEFAULT_GAME_ID,
        )
        event.data.playerId = playerId
        break
      }

      case EventType.PLAYER_ENTRY:
      case EventType.PLAYER_CHANGE_TEAM:
      case EventType.PLAYER_CHANGE_ROLE:
      case EventType.PLAYER_CHANGE_NAME: {
        if (!event.meta) {
          throw new Error(`${event.eventType} event missing meta`)
        }

        const { steamId, playerName } = event.meta
        const playerId = await this.playerService.getOrCreatePlayer(
          steamId,
          playerName,
          this.DEFAULT_GAME_ID,
        )
        event.data.playerId = playerId
        break
      }

      case EventType.CHAT_MESSAGE: {
        if (!event.meta) {
          throw new Error("CHAT event missing meta")
        }

        const { steamId, playerName } = event.meta
        const playerId = await this.playerService.getOrCreatePlayer(
          steamId,
          playerName,
          this.DEFAULT_GAME_ID,
        )
        event.data.playerId = playerId
        break
      }

      default:
        // Other events may not need player ID resolution
        break
    }
  }


  /**
   * Get top players by ranking
   */
  async getTopPlayers(
    limit: number = this.DEFAULT_TOP_PLAYERS_LIMIT,
    game: string = this.DEFAULT_GAME_ID,
    includeHidden: boolean = false,
  ) {
    return this.playerService.getTopPlayers(limit, game, includeHidden)
  }
}

export function createEventProcessorService(
  db: DatabaseClient = databaseClient,
  logger: ILogger = defaultLogger,
  opts: { logBots?: boolean } = {},
): IEventProcessor {
  // Service Layer
  const playerService = new PlayerService(db, logger)
  const weaponService = new WeaponService(db, logger)
  const eventService = new EventService(db, logger)

  // Handler Layer
  const playerHandler = new PlayerHandler(playerService, logger)
  const weaponHandler = new WeaponHandler(weaponService, db, logger)
  const matchHandler = new MatchHandler(playerService, db, logger)
  const rankingHandler = new RankingHandler(playerService, weaponService, logger)

  return new EventProcessorService(
    eventService,
    playerService,
    playerHandler,
    weaponHandler,
    matchHandler,
    rankingHandler,
    logger,
    opts,
  )
}
