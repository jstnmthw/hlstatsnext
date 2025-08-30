/**
 * Action Definition Validator
 *
 * Validates action definitions and provides early return logic for action handlers.
 * This validator encapsulates the common pattern of:
 * 1. Looking up action definitions from the database
 * 2. Checking if the action is valid for the specific event type
 * 3. Providing early return results for invalid actions
 *
 * This reduces cyclomatic complexity in action handlers and centralizes
 * action validation logic in a reusable, testable component.
 *
 * @example Basic Usage
 * ```typescript
 * const validator = new ActionDefinitionValidator(repository, logger)
 *
 * // Validate player action
 * const result = await validator.validatePlayerAction('cstrike', 'Kill', 'CT')
 * if (result.shouldEarlyReturn) {
 *   return result.earlyResult! // Handle early return gracefully
 * }
 * const actionDef = result.actionDef! // Safe to use, guaranteed non-null
 * ```
 *
 * @example Error Handling
 * ```typescript
 * // Unknown actions are handled gracefully
 * const result = await validator.validatePlayerAction('cstrike', 'UnknownAction')
 * if (result.shouldEarlyReturn) {
 *   // Returns { success: true } - graceful degradation
 *   return result.earlyResult!
 * }
 * ```
 */

import type { IActionRepository } from "../action.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { HandlerResult } from "@/shared/types/common"

export interface ActionDefinitionResult {
  actionDef: {
    id: number
    code: string
    rewardPlayer: number
    rewardTeam: number
    forPlayerActions: boolean
    forPlayerPlayerActions: boolean
    forTeamActions: boolean
    forWorldActions: boolean
  } | null
  shouldEarlyReturn: boolean
  earlyResult?: HandlerResult
}

export class ActionDefinitionValidator {
  constructor(
    private readonly repository: IActionRepository,
    private readonly logger: ILogger,
  ) {}

  async validatePlayerAction(
    game: string,
    actionCode: string,
    team?: string,
  ): Promise<ActionDefinitionResult> {
    const actionDef = await this.repository.findActionByCode(game, actionCode, team)

    if (!actionDef) {
      this.logger.warn(`Unknown action code: ${actionCode} for game ${game}`)
      return {
        actionDef: null,
        shouldEarlyReturn: true,
        earlyResult: { success: true }, // Don't fail on unknown actions
      }
    }

    if (!actionDef.forPlayerActions) {
      return {
        actionDef,
        shouldEarlyReturn: true,
        earlyResult: { success: true },
      }
    }

    return { actionDef, shouldEarlyReturn: false }
  }

  async validatePlayerPlayerAction(
    game: string,
    actionCode: string,
    team?: string,
  ): Promise<ActionDefinitionResult> {
    const actionDef = await this.repository.findActionByCode(game, actionCode, team)

    if (!actionDef) {
      this.logger.warn(`Unknown action code: ${actionCode} for game ${game}`)
      return {
        actionDef: null,
        shouldEarlyReturn: true,
        earlyResult: { success: true }, // Don't fail on unknown actions
      }
    }

    if (!actionDef.forPlayerPlayerActions) {
      return {
        actionDef,
        shouldEarlyReturn: true,
        earlyResult: { success: true },
      }
    }

    return { actionDef, shouldEarlyReturn: false }
  }

  async validateTeamAction(
    game: string,
    actionCode: string,
    team?: string,
  ): Promise<ActionDefinitionResult> {
    const actionDef = await this.repository.findActionByCode(game, actionCode, team)

    if (!actionDef) {
      this.logger.warn(`Unknown action code: ${actionCode} for game ${game}`)
      return {
        actionDef: null,
        shouldEarlyReturn: true,
        earlyResult: { success: true }, // Don't fail on unknown actions
      }
    }

    if (!actionDef.forTeamActions) {
      return {
        actionDef,
        shouldEarlyReturn: true,
        earlyResult: { success: true },
      }
    }

    return { actionDef, shouldEarlyReturn: false }
  }

  async validateWorldAction(
    game: string,
    actionCode: string,
    team?: string,
  ): Promise<ActionDefinitionResult> {
    const actionDef = await this.repository.findActionByCode(game, actionCode, team)

    if (!actionDef) {
      this.logger.warn(`Unknown action code: ${actionCode} for game ${game}`)
      return {
        actionDef: null,
        shouldEarlyReturn: true,
        earlyResult: { success: true }, // Don't fail on unknown actions
      }
    }

    if (!actionDef.forWorldActions) {
      return {
        actionDef,
        shouldEarlyReturn: true,
        earlyResult: { success: true },
      }
    }

    return { actionDef, shouldEarlyReturn: false }
  }
}
