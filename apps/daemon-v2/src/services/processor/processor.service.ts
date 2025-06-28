/*
  EventProcessorService
  ---------------------
  Consumes raw events from the ingress queue, validates them, and stores them
  using the database package. At this stage it only exposes an enqueue method.
*/

import { EventType } from "@/types/common/events"
import type { GameEvent } from "@/types/common/events"
import { DatabaseClient } from "@/database/client"
import { PlayerHandler } from "./handlers/player.handler"
import { WeaponHandler } from "./handlers/weapon.handler"
import { MatchHandler } from "./handlers/match.handler"
import { RankingHandler } from "./handlers/ranking.handler"
import { logger } from "@/utils/logger"
import { EventEmitter } from "events"

export interface IEventProcessor {
  enqueue(event: unknown): Promise<void>
}

export class EventProcessorService extends EventEmitter implements IEventProcessor {
  private readonly db: DatabaseClient
  private readonly opts: { logBots?: boolean }

  // Handlers for processing events
  private readonly playerHandler: PlayerHandler
  private readonly weaponHandler: WeaponHandler
  private readonly matchHandler: MatchHandler
  private readonly rankingHandler: RankingHandler

  constructor(db?: DatabaseClient, opts: { logBots?: boolean } = {}) {
    super()

    // If a DatabaseClient is supplied use it, otherwise create a new one so that
    // existing callers (e.g. production entry-point) remain functional.
    this.db = db ?? new DatabaseClient()
    this.opts = { logBots: true, ...opts }

    // Initialize handlers
    this.playerHandler = new PlayerHandler(this.db)
    this.weaponHandler = new WeaponHandler(this.db)
    this.matchHandler = new MatchHandler(this.db)
    this.rankingHandler = new RankingHandler(this.db)
  }

  /* Existing enqueue placeholder (kept for API compatibility).
   * IDEALLY this will be removed in a later refactor when queueing lands. */
  async enqueue(): Promise<void> {
    logger.info("Event enqueued for processing")
  }

  async processEvent(event: GameEvent): Promise<void> {
    try {
      // Skip bot events if logBots is false
      if (!this.opts.logBots) {
        const eventWithMeta = event as GameEvent & { meta?: { isBot?: boolean } }
        if (eventWithMeta.meta?.isBot) {
          logger.debug(`Skipping bot event: ${event.eventType}`)
          return
        }
      }

      // Resolve player IDs for events that need them
      await this.resolvePlayerIds(event)

      // Persist the event to the database
      await this.db.createGameEvent(event)

      // Route to appropriate handlers
      switch (event.eventType) {
        case EventType.PLAYER_CONNECT:
        case EventType.PLAYER_DISCONNECT:
        case EventType.PLAYER_KILL:
        case EventType.PLAYER_SUICIDE:
        case EventType.PLAYER_TEAMKILL:
          if (this.playerHandler) {
            await this.playerHandler.handleEvent(event)
          }
          if (event.eventType === EventType.PLAYER_KILL) {
            // Kill events also go to weapon and ranking handlers
            if (this.weaponHandler) {
              await this.weaponHandler.handleEvent(event)
            }
            if (this.rankingHandler) {
              await this.rankingHandler.handleEvent(event)
            }
          }
          break

        case EventType.CHAT_MESSAGE:
          // Chat messages don't need additional processing beyond persistence
          break

        default:
          logger.warn(`Unhandled event type: ${event.eventType}`)
          break
      }

      this.emit("eventProcessed", { success: true, event })
    } catch (error) {
      logger.failed("Failed to process event", error instanceof Error ? error.message : String(error))
      this.emit("eventProcessed", {
        success: false,
        event,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Resolve player IDs from Steam IDs for events that need them
   */
  private async resolvePlayerIds(event: GameEvent): Promise<void> {
    switch (event.eventType) {
      case EventType.PLAYER_CONNECT: {
        if (!event.meta) {
          throw new Error("CONNECT event missing meta")
        }

        const { steamId, playerName } = event.meta
        const playerId = await this.db.getOrCreatePlayer(steamId, playerName, "cstrike")
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
        const killerId = await this.db.getOrCreatePlayer(killer.steamId, killer.playerName, "cstrike")
        const victimId = await this.db.getOrCreatePlayer(victim.steamId, victim.playerName, "cstrike")

        event.data.killerId = killerId
        event.data.victimId = victimId
        break
      }

      case EventType.PLAYER_SUICIDE: {
        if (!event.meta) {
          throw new Error("SUICIDE event missing meta")
        }

        const { steamId, playerName } = event.meta
        const playerId = await this.db.getOrCreatePlayer(steamId, playerName, "cstrike")
        event.data.playerId = playerId
        break
      }

      case EventType.CHAT_MESSAGE: {
        if (!event.meta) {
          throw new Error("CHAT event missing meta")
        }

        const { steamId, playerName } = event.meta
        const playerId = await this.db.getOrCreatePlayer(steamId, playerName, "cstrike")
        event.data.playerId = playerId
        break
      }

      default:
        // Other events may not need player ID resolution
        break
    }
  }

  /**
   * Test database connectivity
   */
  async testDatabaseConnection(): Promise<boolean> {
    try {
      await this.db.testConnection()
      return true
    } catch {
      return false
    }
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    await this.db.disconnect()
  }

  /**
   * Get top players by ranking
   */
  async getTopPlayers(limit: number = 50, game: string = "cstrike", includeHidden: boolean = false) {
    return this.db.getTopPlayers(limit, game, includeHidden)
  }
}
