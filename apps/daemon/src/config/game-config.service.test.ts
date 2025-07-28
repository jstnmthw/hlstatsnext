import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  GameConfigService,
  BOOTSTRAP_CONFIG,
  getDefaultGame,
  getUnknownMap,
} from "./game-config.service"
import type { DatabaseClient } from "@/database/client"
import type { ILogger } from "@/shared/utils/logger.types"

const mockDb = {
  prisma: {
    game: {
      findMany: vi.fn(),
    },
    gameSupported: {
      findMany: vi.fn(),
    },
  },
} as unknown as DatabaseClient

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
} as unknown as ILogger

describe("GameConfigService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    GameConfigService.reset()
  })

  afterEach(() => {
    GameConfigService.reset()
  })

  describe("getInstance", () => {
    it("should create singleton instance when provided db and logger", () => {
      const instance = GameConfigService.getInstance(mockDb, mockLogger)
      expect(instance).toBeInstanceOf(GameConfigService)
    })

    it("should return existing instance on subsequent calls", () => {
      const instance1 = GameConfigService.getInstance(mockDb, mockLogger)
      const instance2 = GameConfigService.getInstance()

      expect(instance1).toBe(instance2)
    })

    it("should throw error when called without parameters before initialization", () => {
      expect(() => GameConfigService.getInstance()).toThrow(
        "GameConfigService must be initialized with db and logger first",
      )
    })
  })

  describe("initialize", () => {
    let service: GameConfigService

    beforeEach(() => {
      service = GameConfigService.getInstance(mockDb, mockLogger)
    })

    it("should load games from database successfully", async () => {
      const mockGames = [
        { code: "cstrike", name: "Counter-Strike", hidden: "0", realgame: "cstrike" },
        { code: "csgo", name: "Counter-Strike: GO", hidden: "0", realgame: "csgo" },
      ]
      const mockSupported = [{ code: "tf2", name: "Team Fortress 2" }]

      vi.mocked(mockDb.prisma.game.findMany).mockResolvedValue(mockGames)
      vi.mocked(mockDb.prisma.gameSupported.findMany).mockResolvedValue(mockSupported)

      await service.initialize()

      expect(mockDb.prisma.game.findMany).toHaveBeenCalledWith({
        where: { hidden: "0" },
      })
      expect(mockDb.prisma.gameSupported.findMany).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith("Loaded 3 games from database")
    })

    it("should not merge duplicate games from supported table", async () => {
      const mockGames = [
        { code: "cstrike", name: "Counter-Strike", hidden: "0", realgame: "cstrike" },
      ]
      const mockSupported = [
        { code: "cstrike", name: "Counter-Strike (Supported)" }, // Duplicate
        { code: "tf2", name: "Team Fortress 2" },
      ]

      vi.mocked(mockDb.prisma.game.findMany).mockResolvedValue(mockGames)
      vi.mocked(mockDb.prisma.gameSupported.findMany).mockResolvedValue(mockSupported)

      await service.initialize()

      expect(service.getGameName("cstrike")).toBe("Counter-Strike") // Original name preserved
      expect(service.isValidGame("tf2")).toBe(true)
    })

    it("should handle database errors and use fallbacks", async () => {
      vi.mocked(mockDb.prisma.game.findMany).mockRejectedValue(new Error("DB Error"))

      await service.initialize()

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to load games from database, using fallbacks: Error: DB Error",
      )
      expect(service.isValidGame("cstrike")).toBe(true)
      expect(service.isValidGame("csgo")).toBe(true)
    })

    it("should only initialize once", async () => {
      vi.mocked(mockDb.prisma.game.findMany).mockResolvedValue([])
      vi.mocked(mockDb.prisma.gameSupported.findMany).mockResolvedValue([])

      await service.initialize()
      await service.initialize() // Second call

      expect(mockDb.prisma.game.findMany).toHaveBeenCalledTimes(1)
    })

    it("should handle hidden games correctly", async () => {
      const mockGames = [
        { code: "visible", name: "Visible Game", hidden: "0", realgame: "visible" },
        { code: "hidden", name: "Hidden Game", hidden: "1", realgame: "hidden" },
      ]

      vi.mocked(mockDb.prisma.game.findMany).mockResolvedValue(mockGames)
      vi.mocked(mockDb.prisma.gameSupported.findMany).mockResolvedValue([])

      await service.initialize()

      const games = service.getAllGames()
      const visibleGame = games.find((g) => g.code === "visible")
      const hiddenGame = games.find((g) => g.code === "hidden")

      expect(visibleGame?.hidden).toBe(false)
      expect(hiddenGame?.hidden).toBe(true)
    })
  })

  describe("public API methods", () => {
    let service: GameConfigService

    beforeEach(async () => {
      service = GameConfigService.getInstance(mockDb, mockLogger)
      vi.mocked(mockDb.prisma.game.findMany).mockResolvedValue([
        { code: "cstrike", name: "Counter-Strike", hidden: "0", realgame: "cstrike" },
        { code: "csgo", name: "Counter-Strike: GO", hidden: "0", realgame: "csgo" },
      ])
      vi.mocked(mockDb.prisma.gameSupported.findMany).mockResolvedValue([])
      await service.initialize()
    })

    describe("getDefaultGame", () => {
      it("should return bootstrap default game", () => {
        expect(service.getDefaultGame()).toBe(BOOTSTRAP_CONFIG.DEFAULT_GAME)
      })
    })

    describe("isValidGame", () => {
      it("should return true for valid game codes", () => {
        expect(service.isValidGame("cstrike")).toBe(true)
        expect(service.isValidGame("csgo")).toBe(true)
      })

      it("should return false for invalid game codes", () => {
        expect(service.isValidGame("invalid")).toBe(false)
        expect(service.isValidGame("")).toBe(false)
      })

      it("should throw if not initialized", () => {
        const uninitializedService = new GameConfigService(mockDb, mockLogger)

        expect(() => uninitializedService.isValidGame("cstrike")).toThrow(
          "GameConfigService not initialized. Call initialize() first.",
        )
      })
    })

    describe("getGameCodes", () => {
      it("should return array of all game codes", () => {
        const codes = service.getGameCodes()
        expect(codes).toContain("cstrike")
        expect(codes).toContain("csgo")
        expect(codes).toHaveLength(2)
      })
    })

    describe("getGameName", () => {
      it("should return game name for valid codes", () => {
        expect(service.getGameName("cstrike")).toBe("Counter-Strike")
        expect(service.getGameName("csgo")).toBe("Counter-Strike: GO")
      })

      it("should return null for invalid codes", () => {
        expect(service.getGameName("invalid")).toBe(null)
      })
    })

    describe("getGameFromPattern", () => {
      it("should return game code for known patterns", () => {
        expect(service.getGameFromPattern("counter-strike")).toBe("cstrike")
        expect(service.getGameFromPattern("counter-strike: global offensive")).toBe("csgo")
        expect(service.getGameFromPattern("team fortress 2")).toBe("tf2")
      })

      it("should handle case insensitive patterns", () => {
        expect(service.getGameFromPattern("COUNTER-STRIKE")).toBe("cstrike")
        expect(service.getGameFromPattern("Counter-Strike: Global Offensive")).toBe("csgo")
      })

      it("should handle whitespace in patterns", () => {
        expect(service.getGameFromPattern("  counter-strike  ")).toBe("cstrike")
      })

      it("should return null for unknown patterns", () => {
        expect(service.getGameFromPattern("unknown game")).toBe(null)
      })
    })

    describe("getAllGames", () => {
      it("should return array of all game records", () => {
        const games = service.getAllGames()
        expect(games).toHaveLength(2)
        expect(games[0]).toMatchObject({
          code: expect.any(String),
          name: expect.any(String),
          hidden: expect.any(Boolean),
          realgame: expect.any(String),
        })
      })
    })

    describe("map methods", () => {
      it("should return unknown map constant", () => {
        expect(service.getUnknownMap()).toBe(BOOTSTRAP_CONFIG.MAP.UNKNOWN)
      })

      it("should return map fallback constant", () => {
        expect(service.getMapFallback()).toBe(BOOTSTRAP_CONFIG.MAP.FALLBACK)
      })
    })
  })

  describe("fallback mode", () => {
    let service: GameConfigService

    beforeEach(async () => {
      service = GameConfigService.getInstance(mockDb, mockLogger)
      vi.mocked(mockDb.prisma.game.findMany).mockRejectedValue(new Error("DB Error"))
      await service.initialize()
    })

    it("should provide fallback games when database fails", () => {
      expect(service.isValidGame("cstrike")).toBe(true)
      expect(service.isValidGame("css")).toBe(true)
      expect(service.isValidGame("csgo")).toBe(true)
      expect(service.isValidGame("tf2")).toBe(true)
    })

    it("should return fallback game names", () => {
      expect(service.getGameName("cstrike")).toBe("Counter-Strike")
      expect(service.getGameName("csgo")).toBe("Counter-Strike: Global Offensive")
    })

    it("should have at least 4 fallback games", () => {
      const games = service.getAllGames()
      expect(games.length).toBeGreaterThanOrEqual(4)
    })
  })

  describe("reset static method", () => {
    it("should reset singleton instance", () => {
      const instance1 = GameConfigService.getInstance(mockDb, mockLogger)

      GameConfigService.reset()

      const instance2 = GameConfigService.getInstance(mockDb, mockLogger)
      expect(instance1).not.toBe(instance2)
    })
  })
})

describe("compatibility functions", () => {
  it("should export getDefaultGame function", () => {
    expect(getDefaultGame()).toBe(BOOTSTRAP_CONFIG.DEFAULT_GAME)
  })

  it("should export getUnknownMap function", () => {
    expect(getUnknownMap()).toBe(BOOTSTRAP_CONFIG.MAP.UNKNOWN)
  })
})
