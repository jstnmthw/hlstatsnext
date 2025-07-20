/**
 * ActionService Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ActionService } from './action.service'
import { createMockLogger } from '../../test-support/mocks/logger'
import type { ActionPlayerEvent, ActionPlayerPlayerEvent, ActionTeamEvent, WorldActionEvent, ActionEvent } from './action.types'
import { EventType } from '@/shared/types/events'

describe('ActionService', () => {
  let actionService: ActionService
  let mockLogger: ReturnType<typeof createMockLogger>

  beforeEach(() => {
    mockLogger = createMockLogger()
    actionService = new ActionService(mockLogger)
  })

  describe('Service instantiation', () => {
    it('should create service instance', () => {
      expect(actionService).toBeDefined()
      expect(actionService).toBeInstanceOf(ActionService)
    })

    it('should have handleActionEvent method', () => {
      expect(actionService.handleActionEvent).toBeDefined()
      expect(typeof actionService.handleActionEvent).toBe('function')
    })
  })

  describe('handleActionEvent', () => {
    it('should handle ACTION_PLAYER events', async () => {
      const playerActionEvent: ActionPlayerEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ACTION_PLAYER,
        data: {
          playerId: 1,
          actionCode: 'score',
          game: 'csgo',
          team: 'ct',
          bonus: 10,
        },
      }

      const result = await actionService.handleActionEvent(playerActionEvent)

      expect(result.success).toBe(true)
      expect(mockLogger.debug).toHaveBeenCalledWith('Player action: score by player 1')
    })

    it('should handle ACTION_PLAYER_PLAYER events', async () => {
      const playerPlayerActionEvent: ActionPlayerPlayerEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ACTION_PLAYER_PLAYER,
        data: {
          playerId: 1,
          victimId: 2,
          actionCode: 'assist',
          game: 'csgo',
          team: 'ct',
          bonus: 5,
        },
      }

      const result = await actionService.handleActionEvent(playerPlayerActionEvent)

      expect(result.success).toBe(true)
      expect(mockLogger.debug).toHaveBeenCalledWith('Player-player action: assist by 1 on 2')
    })

    it('should handle ACTION_TEAM events', async () => {
      const teamActionEvent: ActionTeamEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ACTION_TEAM,
        data: {
          team: 'ct',
          actionCode: 'round_win',
          game: 'csgo',
          playersAffected: [1, 2, 3],
          bonus: 25,
        },
      }

      const result = await actionService.handleActionEvent(teamActionEvent)

      expect(result.success).toBe(true)
      expect(mockLogger.debug).toHaveBeenCalledWith('Team action: round_win by team ct')
    })

    it('should handle ACTION_WORLD events', async () => {
      const worldActionEvent: WorldActionEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ACTION_WORLD,
        data: {
          actionCode: 'map_start',
          game: 'csgo',
          bonus: 0,
        },
      }

      const result = await actionService.handleActionEvent(worldActionEvent)

      expect(result.success).toBe(true)
      expect(mockLogger.debug).toHaveBeenCalledWith('World action: map_start')
    })

    it('should handle unknown event types gracefully', async () => {
      const unknownEvent: ActionPlayerEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ACTION_PLAYER,
        data: {
          playerId: 1,
          actionCode: 'unknown',
          game: 'csgo',
        },
      }

      const result = await actionService.handleActionEvent(unknownEvent)

      expect(result.success).toBe(true)
    })

    it('should handle errors and return failure result', async () => {
      // Mock logger to throw an error
      vi.spyOn(mockLogger, 'debug').mockImplementation(() => {
        throw new Error('Logger error')
      })

      const playerActionEvent: ActionPlayerEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ACTION_PLAYER,
        data: {
          playerId: 1,
          actionCode: 'score',
          game: 'csgo',
        },
      }

      const result = await actionService.handleActionEvent(playerActionEvent)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Logger error')
    })
  })

  describe('Action event data validation', () => {
    it('should handle minimal ACTION_PLAYER event data', async () => {
      const minimalEvent: ActionPlayerEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ACTION_PLAYER,
        data: {
          playerId: 1,
          actionCode: 'basic_action',
          game: 'csgo',
        },
      }

      const result = await actionService.handleActionEvent(minimalEvent)

      expect(result.success).toBe(true)
      expect(mockLogger.debug).toHaveBeenCalledWith('Player action: basic_action by player 1')
    })

    it('should handle ACTION_TEAM event without players affected', async () => {
      const teamEvent: ActionTeamEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ACTION_TEAM,
        data: {
          team: 'terrorist',
          actionCode: 'bomb_plant',
          game: 'csgo',
        },
      }

      const result = await actionService.handleActionEvent(teamEvent)

      expect(result.success).toBe(true)
      expect(mockLogger.debug).toHaveBeenCalledWith('Team action: bomb_plant by team terrorist')
    })

    it('should handle ACTION_WORLD event with zero bonus', async () => {
      const worldEvent: WorldActionEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ACTION_WORLD,
        data: {
          actionCode: 'round_start',
          game: 'csgo',
          bonus: 0,
        },
      }

      const result = await actionService.handleActionEvent(worldEvent)

      expect(result.success).toBe(true)
      expect(mockLogger.debug).toHaveBeenCalledWith('World action: round_start')
    })
  })

  describe('Error handling edge cases', () => {
    it('should handle non-Error exceptions', async () => {
      vi.spyOn(mockLogger, 'debug').mockImplementation(() => {
        throw 'String error'
      })

      const event: ActionPlayerEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ACTION_PLAYER,
        data: {
          playerId: 1,
          actionCode: 'test',
          game: 'csgo',
        },
      }

      const result = await actionService.handleActionEvent(event)

      expect(result.success).toBe(false)
      expect(result.error).toBe('String error')
    })
  })
})