/**
 * Player Entry Event Handler
 *
 * Handles player entry events including synthesizing connect events
 * for bots and updating player last event timestamps.
 */

import type { IMapService } from "@/modules/map/map.service"
import type { IMatchService } from "@/modules/match/match.types"
import type { IPlayerSessionService } from "@/modules/player/types/player-session.types"
import type { IPlayerRepository, PlayerEvent } from "@/modules/player/types/player.types"
import { StatUpdateBuilder } from "@/shared/application/utils/stat-update.builder"
import type { HandlerResult } from "@/shared/types/common"
import type { PlayerMeta } from "@/shared/types/events"
import { EventType } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import { BasePlayerEventHandler } from "./base-player-event.handler"

export class EntryEventHandler extends BasePlayerEventHandler {
  constructor(
    repository: IPlayerRepository,
    logger: ILogger,
    private readonly sessionService: IPlayerSessionService,
    matchService?: IMatchService,
    mapService?: IMapService,
  ) {
    super(repository, logger, matchService, mapService)
  }

  async handle(event: PlayerEvent): Promise<HandlerResult> {
    return this.safeHandle(event, async () => {
      if (event.eventType !== EventType.PLAYER_ENTRY) {
        return this.createErrorResult("Invalid event type for EntryEventHandler")
      }

      const entry = event as { data: { playerId?: number; gameUserId?: number }; meta?: PlayerMeta }
      const { playerId, gameUserId } = entry.data
      const meta = entry.meta

      if (!playerId) {
        return this.createErrorResult("No playerId in PLAYER_ENTRY event")
      }

      this.logger.info(
        `Processing PLAYER_ENTRY for player ${playerId} (gameUserId: ${gameUserId})`,
        {
          serverId: event.serverId,
          playerId,
          gameUserId,
          playerName: meta?.playerName,
          isBot: meta?.isBot,
        },
      )

      // Create or update session if we have the necessary information
      await this.ensureSessionExists(event.serverId, playerId, gameUserId, meta)

      // Get current map
      const map = await this.getCurrentMap(event.serverId)

      // Synthesize connect if needed (bots often have only "entered the game")
      await this.synthesizeConnectIfNeeded(playerId, event.serverId, map)

      // Log entry event and update player last event
      const operations: Array<Promise<unknown>> = []

      operations.push(
        this.repository.createEntryEvent?.(playerId, event.serverId, map) ?? Promise.resolve(),
      )

      const playerUpdate = StatUpdateBuilder.create().updateLastEvent()
      operations.push(this.repository.update(playerId, playerUpdate.build()))

      await Promise.all(operations)

      this.logger.info(`Player entry processed: ${playerId} (${meta?.playerName || "unknown"})`)

      return this.createSuccessResult()
    })
  }

  /**
   * Ensure a session exists for the player, creating one if necessary
   */
  private async ensureSessionExists(
    serverId: number,
    playerId: number,
    gameUserId?: number,
    meta?: PlayerMeta,
  ): Promise<void> {
    try {
      // Check if session already exists
      const existingSession = await this.sessionService.getSessionByPlayerId(serverId, playerId)

      if (existingSession) {
        this.logger.debug(`Session already exists for player ${playerId}`, {
          serverId,
          playerId,
          existingGameUserId: existingSession.gameUserId,
          providedGameUserId: gameUserId,
        })
        return
      }

      // If we don't have gameUserId, try to get it from RCON status
      if (gameUserId === undefined && meta?.playerName) {
        this.logger.info(`No gameUserId provided for player ${playerId}, trying RCON status lookup`)
        // We'll implement this fallback later
        return
      }

      // Create session if we have the required information
      if (gameUserId !== undefined && meta?.steamId && meta?.playerName) {
        await this.sessionService.createSession({
          serverId,
          gameUserId,
          databasePlayerId: playerId,
          steamId: meta.steamId,
          playerName: meta.playerName,
          isBot: meta.isBot || false,
        })

        this.logger.info(`Created session for PLAYER_ENTRY`, {
          serverId,
          playerId,
          gameUserId,
          playerName: meta.playerName,
          isBot: meta.isBot,
        })
      } else {
        this.logger.warn(`Cannot create session - missing required data`, {
          serverId,
          playerId,
          gameUserId,
          hasSteamId: !!meta?.steamId,
          hasPlayerName: !!meta?.playerName,
        })
      }
    } catch (error) {
      this.logger.error(`Failed to ensure session exists for player ${playerId}`, {
        serverId,
        playerId,
        gameUserId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Synthesize a connect event if one doesn't exist recently
   */
  private async synthesizeConnectIfNeeded(
    playerId: number,
    serverId: number,
    map: string,
  ): Promise<void> {
    try {
      const hasRecent = await this.repository.hasRecentConnect?.(serverId, playerId, 120000)
      if (!hasRecent) {
        await this.repository.createConnectEvent(playerId, serverId, map, "")
        await this.repository.updateServerForPlayerEvent?.(serverId, {
          activePlayers: { increment: 1 },
          lastEvent: new Date(),
        })
      }
    } catch (error) {
      this.logger.debug(`Failed to synthesize connect event for player ${playerId}: ${error}`)
    }
  }
}
