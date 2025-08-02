/**
 * Action Repository
 *
 * Database operations for action definitions and event logging.
 */

import type { DatabaseClient } from "@/database/client"
import type { IActionRepository, ActionDefinition } from "./action.types"
import type { ILogger } from "@/shared/utils/logger.types"

export class ActionRepository implements IActionRepository {
  constructor(
    private readonly database: DatabaseClient,
    private readonly logger: ILogger,
  ) {}

  async findActionByCode(
    game: string,
    actionCode: string,
    team?: string,
  ): Promise<ActionDefinition | null> {
    try {
      this.logger.debug(
        `Looking up action: game=${game}, code=${actionCode}, team=${team || "undefined"}`,
      )

      const action = await this.database.prisma.action.findFirst({
        where: {
          game,
          code: actionCode,
          // If team is provided, match it exactly, otherwise allow empty team
          team: team || "",
        },
        orderBy: [
          // Prefer exact team matches over generic ones
          { team: team ? "desc" : "asc" },
        ],
      })

      this.logger.debug(`Action lookup result: ${action ? `Found ID ${action.id}` : "Not found"}`)

      if (!action) {
        return null
      }

      return {
        id: action.id,
        game: action.game,
        code: action.code,
        rewardPlayer: action.rewardPlayer,
        rewardTeam: action.reward_team,
        team: action.team,
        description: action.description,
        forPlayerActions: action.for_PlayerActions === "1",
        forPlayerPlayerActions: action.for_PlayerPlayerActions === "1",
        forTeamActions: action.for_TeamActions === "1",
        forWorldActions: action.for_WorldActions === "1",
      }
    } catch (error) {
      throw new Error(`Failed to find action by code: ${error}`)
    }
  }

  async logPlayerAction(
    playerId: number,
    actionId: number,
    serverId: number,
    map: string,
    bonus: number = 0,
  ): Promise<void> {
    try {
      this.logger.debug(
        `Attempting to log player action: playerId=${playerId}, actionId=${actionId}, serverId=${serverId}, map="${map}", bonus=${bonus}`,
      )

      const result = await this.database.prisma.eventPlayerAction.create({
        data: {
          eventTime: new Date(),
          playerId,
          actionId,
          serverId,
          map: map || "",
          bonus,
        },
      })

      this.logger.debug(`Player action logged successfully: record ID ${result.id}`)
    } catch (error) {
      this.logger.error(`Failed to log player action: ${error}`)
      throw new Error(`Failed to log player action: ${error}`)
    }
  }

  async logPlayerPlayerAction(
    playerId: number,
    victimId: number,
    actionId: number,
    serverId: number,
    map: string,
    bonus: number = 0,
  ): Promise<void> {
    try {
      await this.database.prisma.eventPlayerPlayerAction.create({
        data: {
          eventTime: new Date(),
          playerId,
          victimId,
          actionId,
          serverId,
          map: map || "",
          bonus,
        },
      })
    } catch (error) {
      throw new Error(`Failed to log player-player action: ${error}`)
    }
  }

  async logTeamAction(
    serverId: number,
    actionId: number,
    map: string,
    bonus: number = 0,
  ): Promise<void> {
    try {
      await this.database.prisma.eventTeamBonus.create({
        data: {
          eventTime: new Date(),
          serverId,
          actionId,
          map: map || "",
          bonus,
        },
      })
    } catch (error) {
      throw new Error(`Failed to log team action: ${error}`)
    }
  }

  async logWorldAction(
    serverId: number,
    actionId: number,
    map: string,
    bonus: number = 0,
  ): Promise<void> {
    try {
      await this.database.prisma.eventWorldAction.create({
        data: {
          eventTime: new Date(),
          serverId,
          actionId,
          map: map || "",
          bonus,
        },
      })
    } catch (error) {
      throw new Error(`Failed to log world action: ${error}`)
    }
  }
}
