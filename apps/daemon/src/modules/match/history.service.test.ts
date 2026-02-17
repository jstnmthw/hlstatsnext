/**
 * PlayerHistoryService Unit Tests
 */

import { createMockLogger } from "@/tests/mocks/logger"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PlayerHistoryService } from "./history.service"
import type { IMatchRepository, PlayerHistoryData } from "./match.types"

function createMockRepository(): IMatchRepository {
  return {
    updateBombStats: vi.fn(),
    incrementServerRounds: vi.fn(),
    updateTeamWins: vi.fn(),
    resetMapStats: vi.fn(),
    getLastKnownMap: vi.fn(),
    findServerById: vi.fn(),
    createPlayerHistory: vi.fn(),
    updateMapCount: vi.fn(),
    updateServerStats: vi.fn(),
    getPlayerSkill: vi.fn(),
  }
}

function createSnapshot(overrides: Partial<PlayerHistoryData> = {}): PlayerHistoryData {
  return {
    playerId: 1,
    eventTime: new Date(2025, 7, 11),
    game: "cstrike",
    kills: 1,
    deaths: 0,
    suicides: 0,
    shots: 5,
    hits: 3,
    headshots: 1,
    teamkills: 0,
    connectionTime: 60,
    killStreak: 1,
    deathStreak: 0,
    skill: 1010,
    skillChange: 10,
    ...overrides,
  }
}

describe("PlayerHistoryService", () => {
  let service: PlayerHistoryService
  let mockRepo: IMatchRepository
  let mockLogger: ReturnType<typeof createMockLogger>

  beforeEach(() => {
    vi.clearAllMocks()
    mockRepo = createMockRepository()
    mockLogger = createMockLogger()
    service = new PlayerHistoryService(mockRepo, mockLogger)
  })

  describe("markDirty", () => {
    it("should store first snapshot for a player", () => {
      const snapshot = createSnapshot({ playerId: 1 })
      service.markDirty(snapshot)

      // Verify via flush
      vi.mocked(mockRepo.createPlayerHistory).mockResolvedValue(undefined)
      void service.flush()
      expect(mockRepo.createPlayerHistory).toHaveBeenCalledWith(snapshot)
    })

    it("should merge numeric counters additively when player already exists", async () => {
      const first = createSnapshot({
        playerId: 1,
        kills: 3,
        deaths: 1,
        shots: 10,
        hits: 5,
        headshots: 2,
      })
      const second = createSnapshot({
        playerId: 1,
        kills: 2,
        deaths: 3,
        shots: 8,
        hits: 4,
        headshots: 1,
      })

      service.markDirty(first)
      service.markDirty(second)

      vi.mocked(mockRepo.createPlayerHistory).mockResolvedValue(undefined)
      await service.flush()

      expect(mockRepo.createPlayerHistory).toHaveBeenCalledTimes(1)
      const merged = vi.mocked(mockRepo.createPlayerHistory).mock.calls[0]![0]
      expect(merged.kills).toBe(5) // 3 + 2
      expect(merged.deaths).toBe(4) // 1 + 3
      expect(merged.shots).toBe(18) // 10 + 8
      expect(merged.hits).toBe(9) // 5 + 4
      expect(merged.headshots).toBe(3) // 2 + 1
    })

    it("should keep max of streaks", async () => {
      service.markDirty(createSnapshot({ playerId: 1, killStreak: 5, deathStreak: 2 }))
      service.markDirty(createSnapshot({ playerId: 1, killStreak: 3, deathStreak: 7 }))

      vi.mocked(mockRepo.createPlayerHistory).mockResolvedValue(undefined)
      await service.flush()

      const merged = vi.mocked(mockRepo.createPlayerHistory).mock.calls[0]![0]
      expect(merged.killStreak).toBe(5) // max(5, 3)
      expect(merged.deathStreak).toBe(7) // max(2, 7)
    })

    it("should keep newer eventTime", async () => {
      const older = new Date(2025, 6, 1)
      const newer = new Date(2025, 7, 1)

      service.markDirty(createSnapshot({ playerId: 1, eventTime: newer }))
      service.markDirty(createSnapshot({ playerId: 1, eventTime: older }))

      vi.mocked(mockRepo.createPlayerHistory).mockResolvedValue(undefined)
      await service.flush()

      const merged = vi.mocked(mockRepo.createPlayerHistory).mock.calls[0]![0]
      expect(merged.eventTime).toEqual(newer)
    })

    it("should keep latest skill and sum skillChange", async () => {
      service.markDirty(createSnapshot({ playerId: 1, skill: 1000, skillChange: 10 }))
      service.markDirty(createSnapshot({ playerId: 1, skill: 1015, skillChange: 5 }))

      vi.mocked(mockRepo.createPlayerHistory).mockResolvedValue(undefined)
      await service.flush()

      const merged = vi.mocked(mockRepo.createPlayerHistory).mock.calls[0]![0]
      expect(merged.skill).toBe(1015) // latest
      expect(merged.skillChange).toBe(15) // 10 + 5
    })

    it("should keep latest game value", async () => {
      service.markDirty(createSnapshot({ playerId: 1, game: "cstrike" }))
      service.markDirty(createSnapshot({ playerId: 1, game: "csgo" }))

      vi.mocked(mockRepo.createPlayerHistory).mockResolvedValue(undefined)
      await service.flush()

      const merged = vi.mocked(mockRepo.createPlayerHistory).mock.calls[0]![0]
      expect(merged.game).toBe("csgo")
    })

    it("should handle undefined numeric values as 0", async () => {
      service.markDirty(createSnapshot({ playerId: 1, kills: undefined, teamkills: undefined }))
      service.markDirty(createSnapshot({ playerId: 1, kills: 3, teamkills: undefined }))

      vi.mocked(mockRepo.createPlayerHistory).mockResolvedValue(undefined)
      await service.flush()

      const merged = vi.mocked(mockRepo.createPlayerHistory).mock.calls[0]![0]
      expect(merged.kills).toBe(3) // 0 + 3
      expect(merged.teamkills).toBe(0) // 0 + 0
    })

    it("should track multiple players independently", async () => {
      service.markDirty(createSnapshot({ playerId: 1, kills: 5 }))
      service.markDirty(createSnapshot({ playerId: 2, kills: 3 }))

      vi.mocked(mockRepo.createPlayerHistory).mockResolvedValue(undefined)
      await service.flush()

      expect(mockRepo.createPlayerHistory).toHaveBeenCalledTimes(2)
    })
  })

  describe("flush", () => {
    it("should do nothing when no dirty players", async () => {
      await service.flush()
      expect(mockRepo.createPlayerHistory).not.toHaveBeenCalled()
    })

    it("should write all dirty players sequentially", async () => {
      service.markDirty(createSnapshot({ playerId: 1 }))
      service.markDirty(createSnapshot({ playerId: 2 }))
      service.markDirty(createSnapshot({ playerId: 3 }))

      vi.mocked(mockRepo.createPlayerHistory).mockResolvedValue(undefined)
      await service.flush()

      expect(mockRepo.createPlayerHistory).toHaveBeenCalledTimes(3)
    })

    it("should clear dirty players after flush", async () => {
      service.markDirty(createSnapshot({ playerId: 1 }))
      vi.mocked(mockRepo.createPlayerHistory).mockResolvedValue(undefined)

      await service.flush()
      expect(mockRepo.createPlayerHistory).toHaveBeenCalledTimes(1)

      // Second flush should be a no-op
      await service.flush()
      expect(mockRepo.createPlayerHistory).toHaveBeenCalledTimes(1)
    })

    it("should continue flushing remaining players when one fails", async () => {
      service.markDirty(createSnapshot({ playerId: 1 }))
      service.markDirty(createSnapshot({ playerId: 2 }))
      service.markDirty(createSnapshot({ playerId: 3 }))

      vi.mocked(mockRepo.createPlayerHistory)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("DB error"))
        .mockResolvedValueOnce(undefined)

      await service.flush()

      expect(mockRepo.createPlayerHistory).toHaveBeenCalledTimes(3)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Failed to write player history for 2"),
      )
    })
  })

  describe("start", () => {
    it("should create an interval timer", () => {
      vi.useFakeTimers()
      service.start(1000)

      vi.mocked(mockRepo.createPlayerHistory).mockResolvedValue(undefined)
      service.markDirty(createSnapshot({ playerId: 1 }))

      vi.advanceTimersByTime(1000)
      expect(mockRepo.createPlayerHistory).toHaveBeenCalled()

      service.stop()
      vi.useRealTimers()
    })

    it("should not create a second timer if already started", () => {
      vi.useFakeTimers()
      service.start(1000)
      service.start(1000) // second call should be no-op

      service.markDirty(createSnapshot({ playerId: 1 }))
      vi.mocked(mockRepo.createPlayerHistory).mockResolvedValue(undefined)

      vi.advanceTimersByTime(1000)
      // Only one flush triggered, not two
      expect(mockRepo.createPlayerHistory).toHaveBeenCalledTimes(1)

      service.stop()
      vi.useRealTimers()
    })

    it("should use default interval of 60000ms", () => {
      vi.useFakeTimers()
      service.start()

      service.markDirty(createSnapshot({ playerId: 1 }))
      vi.mocked(mockRepo.createPlayerHistory).mockResolvedValue(undefined)

      vi.advanceTimersByTime(59999)
      expect(mockRepo.createPlayerHistory).not.toHaveBeenCalled()

      vi.advanceTimersByTime(1)
      expect(mockRepo.createPlayerHistory).toHaveBeenCalled()

      service.stop()
      vi.useRealTimers()
    })
  })

  describe("stop", () => {
    it("should clear the interval timer", () => {
      vi.useFakeTimers()
      service.start(1000)
      service.stop()

      service.markDirty(createSnapshot({ playerId: 1 }))
      vi.advanceTimersByTime(2000)

      // Timer stopped, so flush should never fire
      expect(mockRepo.createPlayerHistory).not.toHaveBeenCalled()
      vi.useRealTimers()
    })

    it("should be safe to call when no timer running", () => {
      expect(() => service.stop()).not.toThrow()
    })

    it("should allow restarting after stop", () => {
      vi.useFakeTimers()
      service.start(1000)
      service.stop()
      service.start(1000) // should work again

      service.markDirty(createSnapshot({ playerId: 1 }))
      vi.mocked(mockRepo.createPlayerHistory).mockResolvedValue(undefined)

      vi.advanceTimersByTime(1000)
      expect(mockRepo.createPlayerHistory).toHaveBeenCalled()

      service.stop()
      vi.useRealTimers()
    })
  })
})
