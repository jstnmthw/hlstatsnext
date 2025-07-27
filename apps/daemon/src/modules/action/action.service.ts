/**
 * Action Service
 */

import type {
  IActionService,
  ActionEvent,
  ActionPlayerEvent,
  ActionPlayerPlayerEvent,
  ActionTeamEvent,
  WorldActionEvent,
} from "./action.types"
import type { IActionRepository } from "./action.types"
import type { IPlayerService } from "@/modules/player/player.types"
import type { IMatchService } from "@/modules/match/match.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { HandlerResult } from "@/shared/types/common"
import { EventType } from "@/shared/types/events"

export class ActionService implements IActionService {
  constructor(
    private readonly repository: IActionRepository,
    private readonly logger: ILogger,
    private readonly playerService?: IPlayerService, // Optional to avoid circular dependency
    private readonly matchService?: IMatchService, // Optional to avoid circular dependency
  ) {}

  async handleActionEvent(event: ActionEvent): Promise<HandlerResult> {
    try {
      switch (event.eventType) {
        case EventType.ACTION_PLAYER:
          return await this.handlePlayerAction(event as ActionPlayerEvent)
        case EventType.ACTION_PLAYER_PLAYER:
          return await this.handlePlayerPlayerAction(event as ActionPlayerPlayerEvent)
        case EventType.ACTION_TEAM:
          return await this.handleTeamAction(event as ActionTeamEvent)
        case EventType.ACTION_WORLD:
          return await this.handleWorldAction(event as WorldActionEvent)
        default:
          return { success: true }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async handlePlayerAction(event: ActionPlayerEvent): Promise<HandlerResult> {
    try {
      const { playerId, actionCode, game, team, bonus } = event.data

      // Look up action definition from database
      const actionDef = await this.repository.findActionByCode(game, actionCode, team)

      if (!actionDef) {
        this.logger.warn(`Unknown action code: ${actionCode} for game ${game}`)
        return { success: true } // Don't fail on unknown actions
      }

      if (!actionDef.forPlayerActions) {
        return { success: true }
      }

      // Verify player exists before logging action
      if (this.playerService) {
        const playerStats = await this.playerService.getPlayerStats(playerId)
        if (!playerStats) {
          this.logger.warn(`Player ${playerId} not found, skipping action: ${actionCode}`)
          return { success: true } // Don't fail, but skip the action
        }
      }

      // Calculate total points (base reward + bonus)
      const totalPoints = actionDef.rewardPlayer + (bonus || 0)

      // Get current map from match service, initialize if needed
      let currentMap = this.matchService?.getCurrentMap(event.serverId) || ""
      if (currentMap === "unknown" && this.matchService) {
        currentMap = await this.matchService.initializeMapForServer(event.serverId)
      }

      // Log the action event to database
      await this.repository.logPlayerAction(
        playerId,
        actionDef.id,
        event.serverId,
        currentMap,
        bonus || 0,
      )

      // Update player skill points if player service is available and there are points to award
      if (this.playerService && totalPoints !== 0) {
        await this.playerService.updatePlayerStats(playerId, {
          skill: totalPoints,
        })
        this.logger.debug(`Updated player stats for ${playerId}`)
      }

      // Log the event with point information
      this.logger.event(
        `Player action: ${actionCode} by player ${playerId} ` +
          `(${totalPoints > 0 ? "+" : ""}${totalPoints} points)`,
      )

      return { success: true, affected: 1 }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async handlePlayerPlayerAction(event: ActionPlayerPlayerEvent): Promise<HandlerResult> {
    try {
      const { playerId, victimId, actionCode, game, team, bonus } = event.data

      // Look up action definition from database
      const actionDef = await this.repository.findActionByCode(game, actionCode, team)

      if (!actionDef) {
        this.logger.warn(`Unknown action code: ${actionCode} for game ${game}`)
        return { success: true } // Don't fail on unknown actions
      }

      if (!actionDef.forPlayerPlayerActions) {
        return { success: true }
      }

      // Verify both players exist before logging action
      if (this.playerService) {
        const [playerStats, victimStats] = await Promise.all([
          this.playerService.getPlayerStats(playerId),
          this.playerService.getPlayerStats(victimId),
        ])
        
        if (!playerStats) {
          this.logger.warn(`Player ${playerId} not found, skipping action: ${actionCode}`)
          return { success: true } // Don't fail, but skip the action
        }
        
        if (!victimStats) {
          this.logger.warn(`Victim ${victimId} not found, skipping action: ${actionCode}`)
          return { success: true } // Don't fail, but skip the action
        }
      }

      // Calculate total points (base reward + bonus)
      const totalPoints = actionDef.rewardPlayer + (bonus || 0)

      // Get current map from match service, initialize if needed
      let currentMap = this.matchService?.getCurrentMap(event.serverId) || ""
      if (currentMap === "unknown" && this.matchService) {
        currentMap = await this.matchService.initializeMapForServer(event.serverId)
      }

      // Log the action event to database
      await this.repository.logPlayerPlayerAction(
        playerId,
        victimId,
        actionDef.id,
        event.serverId,
        currentMap,
        bonus || 0,
      )

      // Update player skill points if player service is available and there are points to award
      if (this.playerService && totalPoints !== 0) {
        await this.playerService.updatePlayerStats(playerId, {
          skill: totalPoints,
        })
        this.logger.debug(`Updated player stats for ${playerId}`)
      }

      // Log the event with point information
      this.logger.event(
        `Player action: ${actionCode} by player ${playerId} on ${victimId} ` +
          `(${totalPoints > 0 ? "+" : ""}${totalPoints} points)`,
      )

      return { success: true, affected: 1 }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async handleTeamAction(event: ActionTeamEvent): Promise<HandlerResult> {
    try {
      const { team, actionCode, game, bonus } = event.data

      // Look up action definition from database
      const actionDef = await this.repository.findActionByCode(game, actionCode, team)

      if (!actionDef) {
        this.logger.warn(`Unknown action code: ${actionCode} for game ${game}`)
        return { success: true } // Don't fail on unknown actions
      }

      if (!actionDef.forTeamActions) {
        return { success: true }
      }

      // Calculate total points (base reward + bonus)
      const totalPoints = actionDef.rewardTeam + (bonus || 0)

      // Get current map from match service, initialize if needed
      let currentMap = this.matchService?.getCurrentMap(event.serverId) || ""
      if (currentMap === "unknown" && this.matchService) {
        currentMap = await this.matchService.initializeMapForServer(event.serverId)
      }

      // Log the action event to database
      await this.repository.logTeamAction(event.serverId, actionDef.id, currentMap, bonus || 0)

      // Log the event with point information
      this.logger.event(
        `Team action: ${actionCode} by team ${team} ` +
          `(${totalPoints > 0 ? "+" : ""}${totalPoints} points)`,
      )

      return { success: true, affected: 1 }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async handleWorldAction(event: WorldActionEvent): Promise<HandlerResult> {
    try {
      const { actionCode, game, bonus } = event.data

      // Look up action definition from database
      const actionDef = await this.repository.findActionByCode(game, actionCode)

      if (!actionDef) {
        this.logger.warn(`Unknown action code: ${actionCode} for game ${game}`)
        return { success: true } // Don't fail on unknown actions
      }

      if (!actionDef.forWorldActions) {
        return { success: true }
      }

      // World actions typically don't have player rewards, but may have server-wide effects
      const totalPoints = bonus || 0

      // Get current map from match service, initialize if needed
      let currentMap = this.matchService?.getCurrentMap(event.serverId) || ""
      if (currentMap === "unknown" && this.matchService) {
        currentMap = await this.matchService.initializeMapForServer(event.serverId)
      }

      // Log the action event to database
      await this.repository.logWorldAction(event.serverId, actionDef.id, currentMap, bonus || 0)

      // Log the event
      this.logger.event(
        `World action: ${actionCode}${totalPoints !== 0 ? ` (${totalPoints > 0 ? "+" : ""}${totalPoints} points)` : ""}`,
      )

      return { success: true, affected: 1 }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}
