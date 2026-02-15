/**
 * Change Name Event Handler Tests
 *
 * Tests for player name change event handling.
 */

import type { IMapService } from "@/modules/map/map.service"
import type { IMatchService } from "@/modules/match/match.types"
import type { IPlayerRepository, PlayerChangeNameEvent } from "@/modules/player/types/player.types"
import { EventType } from "@/shared/types/events"
import { createMockLogger } from "@/tests/mocks/logger"
import { createMockPlayerRepository } from "@/tests/mocks/player.repository.mock"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ChangeNameEventHandler } from "./change-name-event.handler"

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

describe("ChangeNameEventHandler", () => {
  let handler: ChangeNameEventHandler
  let mockRepository: IPlayerRepository
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockMatchService: IMatchService
  let mockMapService: IMapService

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockRepository = createMockPlayerRepository()
    mockMatchService = createMockMatchService()
    mockMapService = createMockMapService()

    handler = new ChangeNameEventHandler(
      mockRepository,
      mockLogger,
      mockMatchService,
      mockMapService,
    )
  })

  describe("handle", () => {
    it("should process valid PLAYER_CHANGE_NAME event", async () => {
      const event: PlayerChangeNameEvent = {
        eventType: EventType.PLAYER_CHANGE_NAME,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 100,
          oldName: "OldPlayer",
          newName: "NewPlayer",
        },
      }

      const result = await handler.handle(event)

      expect(result.success).toBe(true)
      expect(mockRepository.update).toHaveBeenCalledWith(
        100,
        expect.objectContaining({
          lastName: "NewPlayer",
        }),
      )
    })

    it("should return error for invalid event type", async () => {
      const event = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        data: { playerId: 100 },
      } as any

      const result = await handler.handle(event)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Invalid event type")
    })

    it("should create change name event log", async () => {
      const event: PlayerChangeNameEvent = {
        eventType: EventType.PLAYER_CHANGE_NAME,
        timestamp: new Date(),
        serverId: 2,
        data: {
          playerId: 200,
          oldName: "Player1",
          newName: "Player2",
        },
      }

      await handler.handle(event)

      expect(mockRepository.createChangeNameEvent).toHaveBeenCalledWith(
        200,
        2,
        "de_dust2",
        "Player1",
        "Player2",
      )
    })

    it("should update player name usage statistics", async () => {
      const event: PlayerChangeNameEvent = {
        eventType: EventType.PLAYER_CHANGE_NAME,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 100,
          oldName: "OldName",
          newName: "NewName",
        },
      }

      await handler.handle(event)

      expect(mockRepository.upsertPlayerName).toHaveBeenCalledWith(
        100,
        "NewName",
        expect.objectContaining({
          numUses: 1,
        }),
      )
    })

    it("should log name change details", async () => {
      const event: PlayerChangeNameEvent = {
        eventType: EventType.PLAYER_CHANGE_NAME,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 100,
          oldName: "BeforeName",
          newName: "AfterName",
        },
      }

      await handler.handle(event)

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Player 100 changed name from "BeforeName" to "AfterName"'),
      )
    })

    it("should handle change name event log errors gracefully", async () => {
      vi.mocked(mockRepository.createChangeNameEvent).mockRejectedValue(new Error("Database error"))

      const event: PlayerChangeNameEvent = {
        eventType: EventType.PLAYER_CHANGE_NAME,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 100,
          oldName: "Old",
          newName: "New",
        },
      }

      const result = await handler.handle(event)

      expect(result.success).toBe(true)
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to create change-name event"),
      )
    })

    it("should handle name usage update errors gracefully", async () => {
      vi.mocked(mockRepository.upsertPlayerName).mockRejectedValue(new Error("Database error"))

      const event: PlayerChangeNameEvent = {
        eventType: EventType.PLAYER_CHANGE_NAME,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 100,
          oldName: "Old",
          newName: "New",
        },
      }

      const result = await handler.handle(event)

      expect(result.success).toBe(true)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Failed to update player name usage"),
      )
    })
  })
})
