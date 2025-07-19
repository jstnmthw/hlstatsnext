import { describe, it, expect, vi, beforeEach } from "vitest"
import { WeaponHandler } from "../../src/services/processor/handlers/weapon.handler"
import { EventType, PlayerKillEvent, PlayerConnectEvent } from "../../src/types/common/events"
import { createMockLogger } from "../types/test-mocks"
import type { IWeaponService } from "../../src/services/weapon/weapon.types"
import type { DatabaseClient } from "../../src/database/client"

const createWeaponServiceMock = (): IWeaponService => ({
  getSkillMultiplier: vi.fn().mockResolvedValue(1.0),
  getWeaponModifier: vi.fn(),
  getDamageMultiplier: vi.fn().mockResolvedValue(100),
  clearCache: vi.fn(),
  getCacheSize: vi.fn(),
})

describe("WeaponHandler", () => {
  let handler: WeaponHandler
  let mockWeaponService: IWeaponService
  let mockDatabase: DatabaseClient
  const loggerMock = createMockLogger()

  beforeEach(() => {
    vi.clearAllMocks()
    mockWeaponService = createWeaponServiceMock()
    
    mockDatabase = {
      transaction: vi.fn().mockImplementation((callback) => callback({
        eventFrag: { create: vi.fn() },
        weapon: { upsert: vi.fn() },
        player: { update: vi.fn() },
      })),
      testConnection: vi.fn(),
      disconnect: vi.fn(),
      prisma: {
        eventFrag: {
          groupBy: vi.fn(),
        },
        player: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        weapon: {
          findMany: vi.fn(),
        },
      },
    } as unknown as DatabaseClient
    
    handler = new WeaponHandler(mockWeaponService, mockDatabase, loggerMock)
  })

  describe("handleEvent", () => {
    it("should call logger for PLAYER_KILL events", async () => {
      const killEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {
          killerId: 1,
          victimId: 2,
          weapon: "ak47",
          headshot: true,
          killerTeam: "T",
          victimTeam: "CT",
        },
      }

      const result = await handler.handleEvent(killEvent)
      expect(result.success).toBe(true)
      expect(result.weaponsAffected).toEqual(["ak47"])
      expect(loggerMock.event).toHaveBeenCalledWith(
        "Weapon kill recorded: ak47 (headshot: true) by player 1 on 2",
      )
    })

    it("should ignore events other than PLAYER_KILL", async () => {
      const otherEvent = {
        eventType: EventType.PLAYER_CONNECT,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      } as PlayerConnectEvent

      const result = await handler.handleEvent(otherEvent)
      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
      expect(result.weaponsAffected).toBeUndefined()
      expect(loggerMock.event).not.toHaveBeenCalled()
    })

    it("should return success even on internal errors", async () => {
      const killEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {
          killerId: 1,
          victimId: 2,
          weapon: "ak47",
          headshot: true,
          killerTeam: "T",
          victimTeam: "CT",
        },
      }

      const result = await handler.handleEvent(killEvent)
      expect(result.success).toBe(true)
    })
  })
})
