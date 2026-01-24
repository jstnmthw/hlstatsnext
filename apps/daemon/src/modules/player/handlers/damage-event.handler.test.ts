/**
 * Damage Event Handler Tests
 *
 * Tests for player damage event handling.
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { DamageEventHandler } from "./damage-event.handler"
import { EventType } from "@/shared/types/events"
import { createMockLogger } from "@/tests/mocks/logger"
import { createMockPlayerRepository } from "@/tests/mocks/player.repository.mock"
import { createMockMatchService } from "@/tests/mocks/match.service.mock"
import type { IPlayerRepository, PlayerDamageEvent } from "@/modules/player/types/player.types"
import type { IMatchService } from "@/modules/match/match.types"
import type { IMapService } from "@/modules/map/map.service"

function createMockMapService(): IMapService {
  return {
    getCurrentMap: vi.fn().mockResolvedValue("de_dust2"),
    getLastKnownMap: vi.fn(),
    handleMapChange: vi.fn(),
  }
}

describe("DamageEventHandler", () => {
  let handler: DamageEventHandler
  let mockRepository: IPlayerRepository
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockMatchService: IMatchService
  let mockMapService: IMapService

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockRepository = createMockPlayerRepository()
    mockMatchService = createMockMatchService()
    mockMapService = createMockMapService()

    handler = new DamageEventHandler(mockRepository, mockLogger, mockMatchService, mockMapService)
  })

  describe("handle", () => {
    it("should process valid PLAYER_DAMAGE event", async () => {
      const event: PlayerDamageEvent = {
        eventType: EventType.PLAYER_DAMAGE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          attackerId: 100,
          victimId: 200,
          weapon: "ak47",
          damage: 27,
          damageArmor: 0,
          healthRemaining: 73,
          armorRemaining: 100,
          hitgroup: "chest",
          attackerTeam: "CT",
          victimTeam: "TERRORIST",
        },
        meta: {
          killer: {
            playerName: "Attacker",
            steamId: "STEAM_0:1:111",
            isBot: false,
          },
          victim: {
            playerName: "Victim",
            steamId: "STEAM_0:1:222",
            isBot: false,
          },
        },
      }

      const result = await handler.handle(event)

      expect(result.success).toBe(true)
      expect(mockRepository.update).toHaveBeenCalledWith(
        100,
        expect.objectContaining({
          shots: { increment: 1 },
          hits: { increment: 1 },
        }),
      )
    })

    it("should return error for invalid event type", async () => {
      const event = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        data: { attackerId: 100, victimId: 200 },
      } as any

      const result = await handler.handle(event)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Invalid event type")
    })

    it("should track headshots", async () => {
      const event: PlayerDamageEvent = {
        eventType: EventType.PLAYER_DAMAGE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          attackerId: 100,
          victimId: 200,
          weapon: "awp",
          damage: 450,
          damageArmor: 0,
          healthRemaining: 0,
          armorRemaining: 100,
          hitgroup: "head",
          attackerTeam: "CT",
          victimTeam: "TERRORIST",
        },
        meta: {
          killer: {
            playerName: "Sniper",
            steamId: "STEAM_0:1:111",
            isBot: false,
          },
          victim: {
            playerName: "Target",
            steamId: "STEAM_0:1:222",
            isBot: false,
          },
        },
      }

      const result = await handler.handle(event)

      expect(result.success).toBe(true)
      expect(mockRepository.update).toHaveBeenCalledWith(
        100,
        expect.objectContaining({
          headshots: { increment: 1 },
        }),
      )
    })

    it("should not increment headshots for non-head hits", async () => {
      const event: PlayerDamageEvent = {
        eventType: EventType.PLAYER_DAMAGE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          attackerId: 100,
          victimId: 200,
          weapon: "ak47",
          damage: 27,
          damageArmor: 0,
          healthRemaining: 73,
          armorRemaining: 100,
          hitgroup: "stomach",
          attackerTeam: "CT",
          victimTeam: "TERRORIST",
        },
      }

      await handler.handle(event)

      expect(mockRepository.update).toHaveBeenCalledWith(
        100,
        expect.not.objectContaining({
          headshots: expect.anything(),
        }),
      )
    })

    it("should update attacker name stats", async () => {
      const event: PlayerDamageEvent = {
        eventType: EventType.PLAYER_DAMAGE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          attackerId: 100,
          victimId: 200,
          weapon: "m4a1",
          damage: 33,
          damageArmor: 0,
          healthRemaining: 67,
          armorRemaining: 100,
          hitgroup: "chest",
          attackerTeam: "CT",
          victimTeam: "TERRORIST",
        },
        meta: {
          killer: {
            playerName: "FragMaster",
            steamId: "STEAM_0:1:111",
            isBot: false,
          },
          victim: {
            playerName: "Target",
            steamId: "STEAM_0:1:222",
            isBot: false,
          },
        },
      }

      await handler.handle(event)

      expect(mockRepository.upsertPlayerName).toHaveBeenCalledWith(
        100,
        "FragMaster",
        expect.any(Object),
      )
    })

    it("should handle PlayerMeta format", async () => {
      const event: PlayerDamageEvent = {
        eventType: EventType.PLAYER_DAMAGE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          attackerId: 100,
          victimId: 200,
          weapon: "deagle",
          damage: 53,
          damageArmor: 0,
          healthRemaining: 47,
          armorRemaining: 100,
          hitgroup: "chest",
          attackerTeam: "CT",
          victimTeam: "TERRORIST",
        },
        meta: {
          killer: {
            playerName: "OneShot",
            steamId: "STEAM_0:1:333",
            isBot: false,
          },
          victim: {
            playerName: "Victim",
            steamId: "STEAM_0:1:444",
            isBot: false,
          },
        },
      }

      await handler.handle(event)

      expect(mockRepository.upsertPlayerName).toHaveBeenCalledWith(
        100,
        "OneShot",
        expect.any(Object),
      )
    })

    it("should handle name update errors gracefully", async () => {
      vi.mocked(mockRepository.upsertPlayerName).mockRejectedValue(new Error("Database error"))

      const event: PlayerDamageEvent = {
        eventType: EventType.PLAYER_DAMAGE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          attackerId: 100,
          victimId: 200,
          weapon: "ak47",
          damage: 27,
          damageArmor: 0,
          healthRemaining: 73,
          armorRemaining: 100,
          hitgroup: "chest",
          attackerTeam: "CT",
          victimTeam: "TERRORIST",
        },
        meta: {
          killer: {
            playerName: "Attacker",
            steamId: "STEAM_0:1:111",
            isBot: false,
          },
          victim: {
            playerName: "Victim",
            steamId: "STEAM_0:1:222",
            isBot: false,
          },
        },
      }

      const result = await handler.handle(event)

      expect(result.success).toBe(true)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Failed to update player name"),
      )
    })

    it("should log damage details", async () => {
      const event: PlayerDamageEvent = {
        eventType: EventType.PLAYER_DAMAGE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          attackerId: 100,
          victimId: 200,
          weapon: "knife",
          damage: 65,
          damageArmor: 0,
          healthRemaining: 35,
          armorRemaining: 100,
          hitgroup: "stomach",
          attackerTeam: "CT",
          victimTeam: "TERRORIST",
        },
      }

      await handler.handle(event)

      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("Damage: 100 → 200"))
    })
  })
})
