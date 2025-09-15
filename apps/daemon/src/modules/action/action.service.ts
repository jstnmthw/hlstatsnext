/**
 * Action Service
 *
 * Processes game action events with validation and batch optimizations.
 *
 * This service handles four types of action events:
 * - Player Actions: Individual player actions (kills, objectives, etc.)
 * - Player-vs-Player Actions: Actions involving two players (kills, damage, etc.)
 * - Team Actions: Actions affecting entire teams (round wins, objectives, etc.)
 * - World Actions: Server/map-level actions (map changes, server events, etc.)
 *
 * ## Architecture
 *
 * The service uses a validator-based architecture to reduce cyclomatic complexity:
 *
 * ```
 * ActionService
 * ├── ActionDefinitionValidator → Validates action definitions & types
 * ├── PlayerValidator          → Validates player existence & resolution
 * ├── MapResolver              → Resolves current map context
 * └── Business Logic           → Core action processing & rewards
 * ```
 *
 * ## Key Features
 *
 * - **Low Complexity**: Reduced from CC=9 to CC=4-5 per method
 * - **Batch Operations**: Prevents N+1 queries for team actions
 * - **Graceful Degradation**: Unknown actions/players don't fail system
 * - **Context Resolution**: Automatic player resolution via metadata
 * - **Comprehensive Logging**: Action tracking with point calculations
 *
 * ## Performance Optimizations
 *
 * - **Batch Player Lookups**: Single query for multiple players
 * - **Batch Skill Updates**: Grouped updates by skill delta
 * - **Batch Action Logging**: Single query for team action logs
 * - **Early Returns**: Fast exit on invalid data
 *
 * @example Basic Usage
 * ```typescript
 * const actionService = new ActionService(repository, logger, playerService, matchService, rconService)
 *
 * const result = await actionService.handleActionEvent({
 *   eventType: EventType.ACTION_PLAYER,
 *   data: { playerId: 123, actionCode: 'Kill', game: 'cstrike' },
 *   serverId: 1,
 *   timestamp: new Date()
 * })
 *
 * if (result.success) {
 *   console.log(`Processed action affecting ${result.affected} players`)
 * }
 * ```
 *
 * @example Team Action Processing
 * ```typescript
 * // Team actions are automatically batched for performance
 * const result = await actionService.handleActionEvent({
 *   eventType: EventType.ACTION_TEAM,
 *   data: { team: 'CT', actionCode: 'Round_Win', game: 'cstrike', bonus: 5 },
 *   serverId: 1
 * })
 *
 * // Processes all team members in 2-3 queries instead of N individual queries
 * ```
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
import type { IRconService } from "@/modules/rcon/types/rcon.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { HandlerResult } from "@/shared/types/common"
import { EventType } from "@/shared/types/events"
import { ActionDefinitionValidator } from "./validators/action-definition.validator"
import { PlayerValidator } from "./validators/player.validator"
import { MapResolver } from "./validators/map-resolver"

export class ActionService implements IActionService {
  private readonly actionDefinitionValidator: ActionDefinitionValidator
  private readonly playerValidator: PlayerValidator
  private readonly mapResolver: MapResolver

  constructor(
    private readonly repository: IActionRepository,
    private readonly logger: ILogger,
    private readonly playerService?: IPlayerService, // Optional to avoid circular dependency
    private readonly matchService?: IMatchService, // Optional to avoid circular dependency
    private readonly rconService?: IRconService, // Optional - used for real-time map resolution
  ) {
    this.actionDefinitionValidator = new ActionDefinitionValidator(repository, logger)
    this.playerValidator = new PlayerValidator(playerService, logger)
    this.mapResolver = new MapResolver(rconService) // Use RCON service as single source of truth for maps
  }

  async handleActionEvent(event: ActionEvent): Promise<HandlerResult> {
    try {
      switch (event.eventType) {
        case EventType.ACTION_PLAYER:
          return await this.handlePlayerAction(event)
        case EventType.ACTION_PLAYER_PLAYER:
          return await this.handlePlayerPlayerAction(event)
        case EventType.ACTION_TEAM:
          return await this.handleTeamAction(event)
        case EventType.ACTION_WORLD:
          return await this.handleWorldAction(event)
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
      const { actionCode, game, team, bonus } = event.data

      // Validate action definition
      const actionValidation = await this.actionDefinitionValidator.validatePlayerAction(
        game,
        actionCode,
        team,
      )
      if (actionValidation.shouldEarlyReturn) {
        return actionValidation.earlyResult!
      }
      const actionDef = actionValidation.actionDef!

      // Validate and resolve player
      const playerValidation = await this.playerValidator.validateSinglePlayer(
        event.data.playerId,
        actionCode,
        event.meta as { steamId?: string; playerName?: string } | undefined,
        game,
      )
      if (playerValidation.shouldEarlyReturn) {
        return playerValidation.earlyResult!
      }
      const playerId = playerValidation.playerId

      // Calculate total points and resolve map
      const totalPoints = actionDef.rewardPlayer + (bonus || 0)
      const currentMap = await this.mapResolver.resolveCurrentMap(event.serverId)

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
      }

      // Log the event with point information
      this.logger.info(
        `Player action processed: ${actionCode} by player ${playerId} on map ${currentMap} ` +
          `(${totalPoints > 0 ? "+" : ""}${totalPoints} points) (Server ID: ${event.serverId})`,
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

      // Validate action definition
      const actionValidation = await this.actionDefinitionValidator.validatePlayerPlayerAction(
        game,
        actionCode,
        team,
      )
      if (actionValidation.shouldEarlyReturn) {
        return actionValidation.earlyResult!
      }
      const actionDef = actionValidation.actionDef!

      // Validate both players exist
      const playerValidation = await this.playerValidator.validatePlayerPair(
        playerId,
        victimId,
        actionCode,
      )
      if (playerValidation.shouldEarlyReturn) {
        return playerValidation.earlyResult!
      }

      // Calculate total points and resolve map
      const totalPoints = actionDef.rewardPlayer + (bonus || 0)
      const currentMap = await this.mapResolver.resolveCurrentMap(event.serverId)

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
      }

      // Log the event with point information
      this.logger.debug(
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

      // Validate action definition
      const actionValidation = await this.actionDefinitionValidator.validateTeamAction(
        game,
        actionCode,
        team,
      )
      if (actionValidation.shouldEarlyReturn) {
        return actionValidation.earlyResult!
      }
      const actionDef = actionValidation.actionDef!

      // Calculate total points and resolve map
      const totalPoints = actionDef.rewardTeam + (bonus || 0)
      const currentMap = await this.mapResolver.resolveCurrentMap(event.serverId)

      // Log team bonus rows per teammate and grant rewardTeam (using batch operations)
      if (this.matchService) {
        const teamPlayers = this.matchService.getPlayersByTeam(event.serverId, team)
        const validPlayerIds = teamPlayers.filter((pid) => typeof pid === "number" && pid > 0)
        if (validPlayerIds.length > 0) {
          const awardedPerPlayer = actionDef.rewardTeam + (bonus || 0)

          // Batch log team actions instead of N individual queries
          await this.repository.logTeamActionBatch(
            validPlayerIds.map((pid) => ({
              playerId: pid,
              serverId: event.serverId,
              actionId: actionDef.id,
              map: currentMap,
              bonus: awardedPerPlayer,
            })),
          )

          // Batch update player stats instead of N individual queries
          if (this.playerService && actionDef.rewardTeam !== 0) {
            await this.playerService.updatePlayerStatsBatch(
              validPlayerIds.map((pid) => ({
                playerId: pid,
                skillDelta: awardedPerPlayer,
              })),
            )
          }

          // Emit a clear success message for verification at round end/team win flow
          this.logger.info(
            `Awarded team bonus: ${actionDef.code} → ${team} (${validPlayerIds.length} recipients × ${awardedPerPlayer} points each) (Server ID: ${event.serverId})`,
          )
        }
      }

      // Log the event with point information
      this.logger.debug(
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

      // Validate action definition
      const actionValidation = await this.actionDefinitionValidator.validateWorldAction(
        game,
        actionCode,
      )
      if (actionValidation.shouldEarlyReturn) {
        return actionValidation.earlyResult!
      }
      const actionDef = actionValidation.actionDef!

      // World actions typically don't have player rewards, but may have server-wide effects
      const totalPoints = bonus || 0
      const currentMap = await this.mapResolver.resolveCurrentMap(event.serverId)

      // Log the action event to database
      await this.repository.logWorldAction(event.serverId, actionDef.id, currentMap, bonus || 0)

      // Log the event
      this.logger.debug(
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
