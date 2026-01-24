/**
 * Change Team Event Handler Tests
 *
 * Tests for player team change event handling.
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { ChangeTeamEventHandler } from "./change-team-event.handler"
import { EventType } from "@/shared/types/events"
import { createMockLogger } from "@/tests/mocks/logger"
import { createMockPlayerRepository } from "@/tests/mocks/player.repository.mock"
import type { IPlayerRepository, PlayerChangeTeamEvent } from "@/modules/player/types/player.types"
import type { IMatchService } from "@/modules/match/match.types"
import type { IMapService } from "@/modules/map/map.service"

function createMockMatchService(): IMatchService {
  return {
    handleMatchEvent: vi.fn(),
    getMatchStats: vi.fn(),
    resetMatchStats: vi.fn(),
    setPlayerTeam: vi.fn(),
    getPlayersByTeam: vi.fn().mockReturnValue([]),
    getServerGame: vi.fn().mockResolvedValue("cstrike"),
  }
}

function createMockMapService(): IMapService {
  return {
    getCurrentMap: vi.fn().mockResolvedValue("de_dust2"),
    getLastKnownMap: vi.fn(),
    handleMapChange: vi.fn(),
  }
}

describe("ChangeTeamEventHandler", () => {
  let handler: ChangeTeamEventHandler
  let mockRepository: IPlayerRepository
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockMatchService: IMatchService
  let mockMapService: IMapService

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockRepository = createMockPlayerRepository()
    mockMatchService = createMockMatchService()
    mockMapService = createMockMapService()

    handler = new ChangeTeamEventHandler(
      mockRepository,
      mockLogger,
      mockMatchService,
      mockMapService,
    )
  })

  describe("handle", () => {
    it("should handle team change to CT", async () => {
      const event: PlayerChangeTeamEvent = {
        eventType: EventType.PLAYER_CHANGE_TEAM,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 100,
          team: "CT",
        },
      }

      const result = await handler.handle(event)

      expect(result.success).toBe(true)
      expect(mockMatchService.setPlayerTeam).toHaveBeenCalledWith(1, 100, "CT")
      expect(mockRepository.createChangeTeamEvent).toHaveBeenCalledWith(100, 1, "de_dust2", "CT")
      expect(mockRepository.update).toHaveBeenCalled()
    })

    it("should handle team change to TERRORIST", async () => {
      const event: PlayerChangeTeamEvent = {
        eventType: EventType.PLAYER_CHANGE_TEAM,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 100,
          team: "TERRORIST",
        },
      }

      const result = await handler.handle(event)

      expect(result.success).toBe(true)
      expect(mockMatchService.setPlayerTeam).toHaveBeenCalledWith(1, 100, "TERRORIST")
      expect(mockLogger.debug).toHaveBeenCalledWith("Player 100 changed team to TERRORIST")
    })

    it("should handle team change to Spectator", async () => {
      const event: PlayerChangeTeamEvent = {
        eventType: EventType.PLAYER_CHANGE_TEAM,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 100,
          team: "Spectator",
        },
      }

      const result = await handler.handle(event)

      expect(result.success).toBe(true)
      expect(mockMatchService.setPlayerTeam).toHaveBeenCalledWith(1, 100, "Spectator")
    })

    it("should handle team change to Unassigned", async () => {
      const event: PlayerChangeTeamEvent = {
        eventType: EventType.PLAYER_CHANGE_TEAM,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 100,
          team: "Unassigned",
        },
      }

      const result = await handler.handle(event)

      expect(result.success).toBe(true)
      expect(mockMatchService.setPlayerTeam).toHaveBeenCalledWith(1, 100, "Unassigned")
    })

    it("should return error for invalid event type", async () => {
      const event = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        data: {},
      } as any

      const result = await handler.handle(event)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Invalid event type")
    })

    it("should update player lastEvent timestamp", async () => {
      const event: PlayerChangeTeamEvent = {
        eventType: EventType.PLAYER_CHANGE_TEAM,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 100,
          team: "CT",
        },
      }

      await handler.handle(event)

      expect(mockRepository.update).toHaveBeenCalledWith(
        100,
        expect.objectContaining({
          lastEvent: expect.any(Date),
        }),
      )
    })

    it("should work without match service", async () => {
      const handlerWithoutMatch = new ChangeTeamEventHandler(
        mockRepository,
        mockLogger,
        undefined,
        mockMapService,
      )

      const event: PlayerChangeTeamEvent = {
        eventType: EventType.PLAYER_CHANGE_TEAM,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 100,
          team: "CT",
        },
      }

      const result = await handlerWithoutMatch.handle(event)

      expect(result.success).toBe(true)
      expect(mockMatchService.setPlayerTeam).not.toHaveBeenCalled()
    })

    it("should get current map for event log", async () => {
      const event: PlayerChangeTeamEvent = {
        eventType: EventType.PLAYER_CHANGE_TEAM,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 100,
          team: "CT",
        },
      }

      await handler.handle(event)

      expect(mockMapService.getCurrentMap).toHaveBeenCalledWith(1)
    })

    it("should handle TF2 team names", async () => {
      const teams = ["Red", "Blue", "Spectator"]

      for (const team of teams) {
        const event: PlayerChangeTeamEvent = {
          eventType: EventType.PLAYER_CHANGE_TEAM,
          timestamp: new Date(),
          serverId: 1,
          data: {
            playerId: 100,
            team,
          },
        }

        const result = await handler.handle(event)

        expect(result.success).toBe(true)
        expect(mockMatchService.setPlayerTeam).toHaveBeenCalledWith(1, 100, team)
      }
    })

    it("should run operations in parallel", async () => {
      const event: PlayerChangeTeamEvent = {
        eventType: EventType.PLAYER_CHANGE_TEAM,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 100,
          team: "CT",
        },
      }

      await handler.handle(event)

      // Both operations should be called
      expect(mockRepository.createChangeTeamEvent).toHaveBeenCalled()
      expect(mockRepository.update).toHaveBeenCalled()
    })

    it("should handle createChangeTeamEvent failure gracefully", async () => {
      vi.mocked(mockRepository.createChangeTeamEvent).mockRejectedValue(new Error("DB error"))

      const event: PlayerChangeTeamEvent = {
        eventType: EventType.PLAYER_CHANGE_TEAM,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 100,
          team: "CT",
        },
      }

      // Should not throw, error is caught internally
      const result = await handler.handle(event)

      // The handler uses Promise.all, so if one fails, all fail
      expect(result.success).toBe(false)
    })
  })
})
