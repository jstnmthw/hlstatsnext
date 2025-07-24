/**
 * IngressService Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { IngressService } from "./ingress.service"
import { createMockLogger } from "../../tests/mocks/logger"
import { createMockDatabaseClient } from "../../tests/mocks/database"
import type { AppContext } from "../../context"
import type { DatabaseClient } from "@/database/client"
import type { IIngressService } from "./ingress.types"

describe("IngressService", () => {
  let ingressService: IngressService
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockDatabase: ReturnType<typeof createMockDatabaseClient>
  let mockContext: AppContext

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockDatabase = createMockDatabaseClient()

    // Create simplified mock context
    mockContext = {
      database: mockDatabase as unknown as DatabaseClient,
      logger: mockLogger,
      playerService: {
        getOrCreatePlayer: vi.fn().mockResolvedValue(1),
        getPlayerStats: vi.fn(),
        updatePlayerStats: vi.fn(),
        getPlayerRating: vi.fn(),
        updatePlayerRatings: vi.fn(),
        getTopPlayers: vi.fn(),
        getRoundParticipants: vi.fn(),
        handlePlayerEvent: vi.fn(),
        handleKillEvent: vi.fn(),
      },
      matchService: {
        handleMatchEvent: vi.fn().mockResolvedValue({ success: true }),
        handleObjectiveEvent: vi.fn().mockResolvedValue({ success: true }),
        handleKillInMatch: vi.fn().mockResolvedValue({ success: true }),
        getMatchStats: vi.fn(),
        getCurrentMap: vi.fn(),
        initializeMapForServer: vi.fn().mockResolvedValue("unknown"),
        resetMatchStats: vi.fn(),
        updatePlayerWeaponStats: vi.fn(),
        calculateMatchMVP: vi.fn(),
        calculatePlayerScore: vi.fn(),
      },
      weaponService: {
        handleWeaponEvent: vi.fn(),
        updateWeaponStats: vi.fn(),
      },
      rankingService: {
        handleRatingUpdate: vi.fn(),
        calculateRatingAdjustment: vi.fn(),
        calculateSkillAdjustment: vi.fn(),
        calculateSuicidePenalty: vi.fn(),
      },
      actionService: {
        handleActionEvent: vi.fn(),
      },
      gameDetectionService: {
        detectGame: vi.fn().mockResolvedValue({
          gameCode: "csgo",
          confidence: 0.8,
          detection_method: "mock",
        }),
        detectGameFromLogContent: vi.fn(),
        detectGameFromServerQuery: vi.fn(),
        normalizeGameCode: vi.fn(),
      },
      serverService: {
        getServer: vi.fn(),
        getServerByAddress: vi.fn(),
        getServerGame: vi.fn().mockResolvedValue("csgo"),
      },
      ingressService: {} as IIngressService,
    }

    ingressService = new IngressService(
      mockLogger,
      mockDatabase as unknown as DatabaseClient,
      mockContext,
      {
        port: 27501,
        skipAuth: true,
        logBots: false,
      },
    )
  })

  afterEach(() => {
    if (ingressService.isRunning()) {
      ingressService.stop()
    }
  })

  describe("Service instantiation", () => {
    it("should create service instance", () => {
      expect(ingressService).toBeDefined()
      expect(ingressService).toBeInstanceOf(IngressService)
    })

    it("should have required methods", () => {
      expect(ingressService.start).toBeDefined()
      expect(ingressService.stop).toBeDefined()
      expect(ingressService.isRunning).toBeDefined()
      expect(ingressService.processLogLine).toBeDefined()
      expect(ingressService.getStats).toBeDefined()
    })
  })

  describe("Server state management", () => {
    it("should start in stopped state", () => {
      expect(ingressService.isRunning()).toBe(false)
    })

    it("should track statistics", () => {
      const stats = ingressService.getStats()
      expect(stats).toHaveProperty("totalLogsProcessed")
      expect(stats).toHaveProperty("totalErrors")
      expect(typeof stats.totalLogsProcessed).toBe("number")
      expect(typeof stats.totalErrors).toBe("number")
    })
  })

  describe("Log processing", () => {
    it("should process log lines without throwing", async () => {
      const logLine = 'L 01/01/2024 - 12:00:00: World triggered "Round_Start"'

      await expect(ingressService.processLogLine(logLine)).resolves.not.toThrow()
    })

    it("should handle malformed log lines gracefully", async () => {
      const logLine = "Invalid log line format"

      await expect(ingressService.processLogLine(logLine)).resolves.not.toThrow()
    })
  })
})
