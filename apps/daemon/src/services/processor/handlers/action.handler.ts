/**
 * Action Event Handler
 *
 * Processes game-specific actions (bomb plants, flag captures, building objects, etc.)
 * and records them in the appropriate event tables with statistical updates.
 */

import type {
  GameEvent,
  ActionPlayerEvent,
  ActionPlayerPlayerEvent,
  ActionTeamEvent,
  WorldActionEvent,
} from "@/types/common/events"
import type { IActionService } from "@/services/action/action.types"
import type { IPlayerService } from "@/services/player/player.types"
import type { DatabaseClient } from "@/database/client"
import type { ILogger } from "@/utils/logger.types"
import type {
  IActionHandler,
  HandlerResult,
  ActionProcessingContext,
  EventMeta,
} from "./action.handler.types"

export class ActionHandler implements IActionHandler {
  constructor(
    private readonly actionService: IActionService,
    private readonly playerService: IPlayerService,
    private readonly db: DatabaseClient,
    private readonly logger: ILogger,
  ) {}

  async handleEvent(event: GameEvent): Promise<HandlerResult> {
    switch (event.eventType) {
      case "ACTION_PLAYER":
        return this.handlePlayerAction(event)

      case "ACTION_PLAYER_PLAYER":
        return this.handlePlayerPlayerAction(event)

      case "ACTION_TEAM":
        return this.handleTeamAction(event)

      case "ACTION_WORLD":
        return this.handleWorldAction(event)

      default:
        return { success: true } // Event not handled by this handler
    }
  }

  private async handlePlayerAction(event: ActionPlayerEvent): Promise<HandlerResult> {
    if (event.eventType !== "ACTION_PLAYER") return { success: true }

    try {
      const { playerId, actionCode, game, team, bonus, position } = event.data
      const context = this.buildContext(event)

      // Lookup action definition
      const action = await this.actionService.getAction(game, actionCode, team)
      if (!action) {
        this.logger.warn(`Unknown player action: ${game}:${actionCode}:${team || "any"}`)
        return { success: true } // Don't fail for unknown actions
      }

      // Verify this is actually a player action
      if (action.for_PlayerActions !== "1") {
        this.logger.warn(`Action ${actionCode} is not configured for player actions`)
        return { success: true }
      }

      await this.db.transaction(async (tx) => {
        // 1. Record the action event
        await tx.eventPlayerAction.create({
          data: {
            eventTime: context.timestamp,
            serverId: context.serverId,
            map: context.map,
            playerId,
            actionId: action.id,
            bonus: bonus ?? action.reward_player,
            pos_x: position?.x,
            pos_y: position?.y,
            pos_z: position?.z,
          },
        })

        // 2. Update player statistics
        const scoreChange = bonus ?? action.reward_player
        if (scoreChange !== 0) {
          await this.playerService.updatePlayerStats(playerId, {
            skill: scoreChange,
            last_event: Math.floor(Date.now() / 1000),
            // Could add action-specific stat tracking here if needed
          })
        }

        // 3. Update action count
        await tx.action.update({
          where: { id: action.id },
          data: { count: { increment: 1 } },
        })
      })

      this.logger.event(
        `Player action recorded: ${action.description} by player ${playerId} (+${bonus ?? action.reward_player} points)`,
      )

      return {
        success: true,
        actionsProcessed: 1,
        playersAffected: [playerId],
      }
    } catch (error) {
      this.logger.failed(
        `Failed to process player action: ${event.data.actionCode}`,
        error instanceof Error ? error.message : String(error),
      )
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown action processing error",
      }
    }
  }

  private async handlePlayerPlayerAction(event: ActionPlayerPlayerEvent): Promise<HandlerResult> {
    if (event.eventType !== "ACTION_PLAYER_PLAYER") return { success: true }

    try {
      const { playerId, victimId, actionCode, game, team, bonus, actorPosition, victimPosition } =
        event.data
      const context = this.buildContext(event)

      // Lookup action definition
      const action = await this.actionService.getAction(game, actionCode, team)
      if (!action) {
        this.logger.warn(`Unknown player-player action: ${game}:${actionCode}:${team || "any"}`)
        return { success: true }
      }

      // Verify this is actually a player-player action
      if (action.for_PlayerPlayerActions !== "1") {
        this.logger.warn(`Action ${actionCode} is not configured for player-player actions`)
        return { success: true }
      }

      await this.db.transaction(async (tx) => {
        // 1. Record the action event
        await tx.eventPlayerPlayerAction.create({
          data: {
            eventTime: context.timestamp,
            serverId: context.serverId,
            map: context.map,
            playerId,
            victimId,
            actionId: action.id,
            bonus: bonus ?? action.reward_player,
            pos_x: actorPosition?.x,
            pos_y: actorPosition?.y,
            pos_z: actorPosition?.z,
            pos_victim_x: victimPosition?.x,
            pos_victim_y: victimPosition?.y,
            pos_victim_z: victimPosition?.z,
          },
        })

        // 2. Update player statistics for actor
        const scoreChange = bonus ?? action.reward_player
        if (scoreChange !== 0) {
          await this.playerService.updatePlayerStats(playerId, {
            skill: scoreChange,
            last_event: Math.floor(Date.now() / 1000),
          })
        }

        // 3. Update action count
        await tx.action.update({
          where: { id: action.id },
          data: { count: { increment: 1 } },
        })
      })

      this.logger.event(
        `Player-player action recorded: ${action.description} by player ${playerId} on ${victimId} (+${bonus ?? action.reward_player} points)`,
      )

      return {
        success: true,
        actionsProcessed: 1,
        playersAffected: [playerId, victimId],
      }
    } catch (error) {
      this.logger.failed(
        `Failed to process player-player action: ${event.data.actionCode}`,
        error instanceof Error ? error.message : String(error),
      )
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown action processing error",
      }
    }
  }

  private async handleTeamAction(event: ActionTeamEvent): Promise<HandlerResult> {
    if (event.eventType !== "ACTION_TEAM") return { success: true }

    try {
      const { team, actionCode, game, playersAffected, bonus } = event.data
      const context = this.buildContext(event)

      // Lookup action definition
      const action = await this.actionService.getAction(game, actionCode, team)
      if (!action) {
        this.logger.warn(`Unknown team action: ${game}:${actionCode}:${team}`)
        return { success: true }
      }

      // Verify this is actually a team action
      if (action.for_TeamActions !== "1") {
        this.logger.warn(`Action ${actionCode} is not configured for team actions`)
        return { success: true }
      }

      const teamBonus = bonus ?? action.reward_team
      const affectedPlayers = playersAffected || []

      await this.db.transaction(async (tx) => {
        // Award team bonus to all affected players
        for (const playerId of affectedPlayers) {
          await tx.eventTeamBonus.create({
            data: {
              eventTime: context.timestamp,
              serverId: context.serverId,
              map: context.map,
              playerId,
              actionId: action.id,
              bonus: teamBonus,
            },
          })

          // Update player last event time
          if (teamBonus !== 0) {
            await this.playerService.updatePlayerStats(playerId, {
              skill: teamBonus,
              last_event: Math.floor(Date.now() / 1000),
            })
          }
        }

        // Update action count
        await tx.action.update({
          where: { id: action.id },
          data: { count: { increment: 1 } },
        })
      })

      this.logger.event(
        `Team action recorded: ${action.description} for team ${team} (${affectedPlayers.length} players, +${teamBonus} each)`,
      )

      return {
        success: true,
        actionsProcessed: 1,
        playersAffected: affectedPlayers,
      }
    } catch (error) {
      this.logger.failed(
        `Failed to process team action: ${event.data.actionCode}`,
        error instanceof Error ? error.message : String(error),
      )
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown action processing error",
      }
    }
  }

  private async handleWorldAction(event: WorldActionEvent): Promise<HandlerResult> {
    if (event.eventType !== "ACTION_WORLD") return { success: true }

    try {
      const { actionCode, game, bonus } = event.data
      const context = this.buildContext(event)

      // Lookup action definition
      const action = await this.actionService.getAction(game, actionCode)
      if (!action) {
        this.logger.warn(`Unknown world action: ${game}:${actionCode}`)
        return { success: true }
      }

      // Verify this is actually a world action
      if (action.for_WorldActions !== "1") {
        this.logger.warn(`Action ${actionCode} is not configured for world actions`)
        return { success: true }
      }

      await this.db.transaction(async (tx) => {
        // 1. Record the world event
        await tx.eventWorldAction.create({
          data: {
            eventTime: context.timestamp,
            serverId: context.serverId,
            map: context.map,
            actionId: action.id,
            bonus: bonus ?? 0,
          },
        })

        // 2. Update action count
        await tx.action.update({
          where: { id: action.id },
          data: { count: { increment: 1 } },
        })
      })

      this.logger.event(`World action recorded: ${action.description} (+${bonus ?? 0} points)`)

      return {
        success: true,
        actionsProcessed: 1,
      }
    } catch (error) {
      this.logger.failed(
        `Failed to process world action: ${event.data.actionCode}`,
        error instanceof Error ? error.message : String(error),
      )
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown world processing error",
      }
    }
  }

  /**
   * Build processing context from event
   */
  private buildContext(event: GameEvent): ActionProcessingContext {
    const meta = event.meta as EventMeta

    return {
      serverId: meta.serverId ?? 0,
      map: meta.map ?? "",
      timestamp: event.timestamp,
      game: (event.data as ActionPlayerEvent["data"]).game, // All action events have game field
    }
  }
}
