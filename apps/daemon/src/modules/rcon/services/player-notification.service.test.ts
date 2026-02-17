/**
 * PlayerNotificationService Tests
 *
 * Comprehensive tests covering player notification, batch notifications,
 * retry logic, private/public messaging fallback, and cache management.
 */

import type { IPlayerSessionService } from "@/modules/player/types/player-session.types"
import type { ILogger } from "@/shared/utils/logger.types"
import { createMockLogger } from "@/tests/mocks/logger"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { CommandResolverService } from "./command-resolver.service"
import { PlayerNotificationService } from "./player-notification.service"
import type { RconCommandService } from "./rcon-command.service"

describe("PlayerNotificationService", () => {
  let service: PlayerNotificationService
  let mockLogger: ILogger
  let mockRconCommand: RconCommandService
  let mockCommandResolver: CommandResolverService
  let mockSessionService: IPlayerSessionService

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()

    mockLogger = createMockLogger()

    mockRconCommand = {
      execute: vi.fn().mockResolvedValue(undefined),
      executeRaw: vi.fn().mockResolvedValue(undefined),
      executeAnnouncement: vi.fn().mockResolvedValue(undefined),
    } as unknown as RconCommandService

    mockCommandResolver = {
      getCommand: vi.fn().mockResolvedValue("say"),
      getCommandCapabilities: vi.fn().mockResolvedValue({
        supportsBatch: false,
        maxBatchSize: 1,
        requiresHashPrefix: false,
      }),
      supportsBatch: vi.fn().mockResolvedValue(false),
      getBatchLimit: vi.fn().mockResolvedValue(1),
      clearCache: vi.fn(),
      clearServerCache: vi.fn(),
    } as unknown as CommandResolverService

    mockSessionService = {
      createSession: vi.fn(),
      updateSession: vi.fn(),
      removeSession: vi.fn(),
      clearServerSessions: vi.fn(),
      getSessionByGameUserId: vi.fn(),
      getSessionByPlayerId: vi.fn(),
      getSessionBySteamId: vi.fn(),
      getServerSessions: vi.fn(),
      synchronizeServerSessions: vi.fn(),
      convertToGameUserIds: vi.fn().mockResolvedValue([]),
      canSendPrivateMessage: vi.fn().mockResolvedValue(true),
      getSessionStats: vi.fn(),
    }

    service = new PlayerNotificationService(
      mockRconCommand,
      mockCommandResolver as CommandResolverService,
      mockSessionService,
      mockLogger,
    )
  })

  describe("notifyPlayer", () => {
    it("should skip sending when player cannot receive private messages", async () => {
      vi.mocked(mockSessionService.canSendPrivateMessage).mockResolvedValueOnce(false)

      await service.notifyPlayer(1, 100, "Hello")

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Cannot send private message to player 100"),
      )
      expect(mockRconCommand.execute).not.toHaveBeenCalled()
    })

    it("should send notification when player can receive messages", async () => {
      vi.mocked(mockSessionService.canSendPrivateMessage).mockResolvedValueOnce(true)
      vi.mocked(mockCommandResolver.supportsBatch).mockResolvedValueOnce(false)
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValueOnce("hlx_psay")

      await service.notifyPlayer(1, 100, "Hello")

      expect(mockSessionService.canSendPrivateMessage).toHaveBeenCalledWith(1, 100)
      expect(mockRconCommand.execute).toHaveBeenCalled()
    })

    it("should pass options through to notifyMultiplePlayers", async () => {
      vi.mocked(mockSessionService.canSendPrivateMessage).mockResolvedValueOnce(true)
      vi.mocked(mockCommandResolver.supportsBatch).mockResolvedValueOnce(false)
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValueOnce("hlx_psay")

      await service.notifyPlayer(1, 100, "Hello", {
        commandType: "PlayerEventsCommand",
        batchDelay: 50,
      })

      expect(mockRconCommand.execute).toHaveBeenCalledWith(
        1,
        [100],
        "Hello",
        expect.objectContaining({
          commandType: "PlayerEventsCommand",
        }),
      )
    })
  })

  describe("notifyMultiplePlayers", () => {
    it("should return immediately when players array is empty", async () => {
      await service.notifyMultiplePlayers(1, [], "Hello")

      expect(mockRconCommand.execute).not.toHaveBeenCalled()
    })

    it("should use default BroadCastEventsCommand when no commandType specified", async () => {
      vi.mocked(mockCommandResolver.supportsBatch).mockResolvedValueOnce(true)

      await service.notifyMultiplePlayers(1, [{ playerId: 100 }], "Hello")

      expect(mockCommandResolver.supportsBatch).toHaveBeenCalledWith(1, "BroadCastEventsCommand")
    })

    it("should use private messaging when batch is supported", async () => {
      vi.mocked(mockCommandResolver.supportsBatch).mockResolvedValueOnce(true)

      await service.notifyMultiplePlayers(1, [{ playerId: 100 }, { playerId: 200 }], "Hello")

      expect(mockRconCommand.execute).toHaveBeenCalledWith(
        1,
        [100, 200],
        "Hello",
        expect.objectContaining({
          commandType: "BroadCastEventsCommand",
        }),
      )
    })

    it("should use private messaging when command supports private messages", async () => {
      vi.mocked(mockCommandResolver.supportsBatch).mockResolvedValueOnce(false)
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValueOnce("hlx_psay")

      await service.notifyMultiplePlayers(1, [{ playerId: 100 }], "Hello")

      expect(mockRconCommand.execute).toHaveBeenCalled()
    })

    it("should fall back to public notifications when no private messaging support", async () => {
      vi.mocked(mockCommandResolver.supportsBatch).mockResolvedValueOnce(false)
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValueOnce("say") // "say" is not private

      await service.notifyMultiplePlayers(1, [{ playerId: 100, playerName: "Player1" }], "Hello")

      // Should use forceSingle for public notification
      expect(mockRconCommand.execute).toHaveBeenCalledWith(
        1,
        [100],
        "Player1: Hello",
        expect.objectContaining({ forceSingle: true }),
      )
    })

    it("should pass batchDelay and forceSingle through options for private messaging", async () => {
      vi.mocked(mockCommandResolver.supportsBatch).mockResolvedValueOnce(true)

      await service.notifyMultiplePlayers(1, [{ playerId: 100 }], "Hello", {
        batchDelay: 100,
        forceSingle: true,
        commandType: "PlayerEventsCommand",
      })

      expect(mockRconCommand.execute).toHaveBeenCalledWith(
        1,
        [100],
        "Hello",
        expect.objectContaining({
          commandType: "PlayerEventsCommand",
          batchDelay: 100,
          forceSingle: true,
        }),
      )
    })

    it("should throw error and log it with Error instance", async () => {
      vi.mocked(mockCommandResolver.supportsBatch).mockRejectedValueOnce(new Error("Config error"))

      await expect(service.notifyMultiplePlayers(1, [{ playerId: 100 }], "Hello")).rejects.toThrow(
        "Config error",
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to send notification"),
        expect.objectContaining({
          serverId: 1,
          playerCount: 1,
          error: "Config error",
        }),
      )
    })

    it("should throw error and stringify non-Error objects", async () => {
      vi.mocked(mockCommandResolver.supportsBatch).mockRejectedValueOnce("bad thing")

      await expect(service.notifyMultiplePlayers(1, [{ playerId: 100 }], "Hello")).rejects.toBe(
        "bad thing",
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ error: "bad thing" }),
      )
    })

    it("should log completion details after successful notification", async () => {
      vi.mocked(mockCommandResolver.supportsBatch).mockResolvedValueOnce(true)

      await service.notifyMultiplePlayers(1, [{ playerId: 100 }], "Test message", {
        commandType: "PlayerEventsCommand",
      })

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Notification processing completed"),
        expect.objectContaining({
          serverId: 1,
          requestedPlayers: 1,
          commandType: "PlayerEventsCommand",
          messageLength: 12,
          privateMessaging: true,
        }),
      )
    })

    it("should retry on failure using executeWithRetry", async () => {
      vi.mocked(mockCommandResolver.supportsBatch).mockResolvedValueOnce(true)
      vi.mocked(mockRconCommand.execute)
        .mockRejectedValueOnce(new Error("Temporary failure"))
        .mockResolvedValueOnce(undefined)

      // maxRetries=2 means 2 attempts. The delay between retries is 1000*attempt ms
      // which will actually wait, but this test is checking the retry behavior
      await service.notifyMultiplePlayers(1, [{ playerId: 100 }], "Hello", { maxRetries: 2 })

      expect(mockRconCommand.execute).toHaveBeenCalledTimes(2)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Command execution failed, retrying (1/2)"),
      )
    })

    it("should use maxRetries default of 1 (no retry) when not specified", async () => {
      vi.mocked(mockCommandResolver.supportsBatch).mockResolvedValueOnce(true)
      vi.mocked(mockRconCommand.execute).mockRejectedValueOnce(new Error("Fail"))

      await expect(service.notifyMultiplePlayers(1, [{ playerId: 100 }], "Hello")).rejects.toThrow(
        "Fail",
      )

      // Only called once (no retries when maxRetries=1)
      expect(mockRconCommand.execute).toHaveBeenCalledTimes(1)
    })
  })

  describe("broadcastAnnouncement", () => {
    it("should execute announcement with default command type", async () => {
      await service.broadcastAnnouncement(1, "Server announcement")

      expect(mockRconCommand.executeAnnouncement).toHaveBeenCalledWith(
        1,
        "Server announcement",
        "BroadCastEventsCommandAnnounce",
      )
    })

    it("should execute announcement with custom command type", async () => {
      await service.broadcastAnnouncement(1, "Hello", "PlayerEventsCommand")

      expect(mockRconCommand.executeAnnouncement).toHaveBeenCalledWith(
        1,
        "Hello",
        "PlayerEventsCommand",
      )
    })

    it("should log after successful broadcast", async () => {
      await service.broadcastAnnouncement(1, "Test")

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Broadcasted announcement"),
        expect.objectContaining({
          serverId: 1,
          commandType: "BroadCastEventsCommandAnnounce",
          messageLength: 4,
        }),
      )
    })

    it("should throw and log on error with Error instance", async () => {
      vi.mocked(mockRconCommand.executeAnnouncement).mockRejectedValueOnce(new Error("RCON down"))

      await expect(service.broadcastAnnouncement(1, "Hello")).rejects.toThrow("RCON down")

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to broadcast announcement"),
        expect.objectContaining({
          serverId: 1,
          error: "RCON down",
        }),
      )
    })

    it("should throw and log on error with non-Error object", async () => {
      vi.mocked(mockRconCommand.executeAnnouncement).mockRejectedValueOnce(123)

      await expect(service.broadcastAnnouncement(1, "Hello")).rejects.toBe(123)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ error: "123" }),
      )
    })
  })

  describe("supportsPrivateMessaging", () => {
    it("should return true for psay commands", async () => {
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValueOnce("hlx_psay")

      const result = await service.supportsPrivateMessaging(1)

      expect(result).toBe(true)
    })

    it("should return true for tell commands", async () => {
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValueOnce("amx_tell")

      const result = await service.supportsPrivateMessaging(1)

      expect(result).toBe(true)
    })

    it("should return true for pm commands", async () => {
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValueOnce("amx_pm")

      const result = await service.supportsPrivateMessaging(1)

      expect(result).toBe(true)
    })

    it("should return true for hlx_ prefixed commands", async () => {
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValueOnce("hlx_event")

      const result = await service.supportsPrivateMessaging(1)

      expect(result).toBe(true)
    })

    it("should return true for ma_ prefixed commands", async () => {
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValueOnce("ma_hlx_psay")

      const result = await service.supportsPrivateMessaging(1)

      expect(result).toBe(true)
    })

    it("should return true for ms_ prefixed commands", async () => {
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValueOnce("ms_psay")

      const result = await service.supportsPrivateMessaging(1)

      expect(result).toBe(true)
    })

    it("should return false for plain 'say' command", async () => {
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValueOnce("say")

      const result = await service.supportsPrivateMessaging(1)

      expect(result).toBe(false)
    })

    it("should return false for unknown commands without private messaging keywords", async () => {
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValueOnce("custom_broadcast")

      const result = await service.supportsPrivateMessaging(1)

      expect(result).toBe(false)
    })

    it("should use default command type when not specified", async () => {
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValueOnce("say")

      await service.supportsPrivateMessaging(1)

      expect(mockCommandResolver.getCommand).toHaveBeenCalledWith(1, "BroadCastEventsCommand")
    })

    it("should use specified command type", async () => {
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValueOnce("say")

      await service.supportsPrivateMessaging(1, "PlayerEventsCommand")

      expect(mockCommandResolver.getCommand).toHaveBeenCalledWith(1, "PlayerEventsCommand")
    })

    it("should return false and log warning on error", async () => {
      vi.mocked(mockCommandResolver.getCommand).mockRejectedValueOnce(new Error("Resolver failure"))

      const result = await service.supportsPrivateMessaging(1)

      expect(result).toBe(false)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Failed to check private messaging"),
        expect.objectContaining({
          serverId: 1,
          error: "Resolver failure",
        }),
      )
    })

    it("should return false and stringify non-Error on error", async () => {
      vi.mocked(mockCommandResolver.getCommand).mockRejectedValueOnce("bad error")

      const result = await service.supportsPrivateMessaging(1)

      expect(result).toBe(false)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ error: "bad error" }),
      )
    })
  })

  describe("executeRawCommand", () => {
    it("should execute raw command and log success", async () => {
      await service.executeRawCommand(1, "status")

      expect(mockRconCommand.executeRaw).toHaveBeenCalledWith(1, "status")
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Executed raw command"),
        expect.objectContaining({
          serverId: 1,
          command: "status",
        }),
      )
    })

    it("should truncate long commands in log", async () => {
      const longCmd = "x".repeat(200)
      await service.executeRawCommand(1, longCmd)

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          command: longCmd.substring(0, 100),
        }),
      )
    })

    it("should throw and log on error with Error instance", async () => {
      vi.mocked(mockRconCommand.executeRaw).mockRejectedValueOnce(new Error("RCON error"))

      await expect(service.executeRawCommand(1, "status")).rejects.toThrow("RCON error")

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to execute raw command"),
        expect.objectContaining({
          serverId: 1,
          error: "RCON error",
        }),
      )
    })

    it("should throw and log on error with non-Error object", async () => {
      vi.mocked(mockRconCommand.executeRaw).mockRejectedValueOnce("timeout")

      await expect(service.executeRawCommand(1, "status")).rejects.toBe("timeout")

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ error: "timeout" }),
      )
    })
  })

  describe("executePublicNotifications (private, tested via notifyMultiplePlayers)", () => {
    it("should send targeted message with player name for single player", async () => {
      vi.mocked(mockCommandResolver.supportsBatch).mockResolvedValueOnce(false)
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValueOnce("say")

      await service.notifyMultiplePlayers(
        1,
        [{ playerId: 100, playerName: "Player1" }],
        "You scored!",
      )

      expect(mockRconCommand.execute).toHaveBeenCalledWith(
        1,
        [100],
        "Player1: You scored!",
        expect.objectContaining({ forceSingle: true }),
      )
    })

    it("should send generic message when single player has no name", async () => {
      vi.mocked(mockCommandResolver.supportsBatch).mockResolvedValueOnce(false)
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValueOnce("say")

      await service.notifyMultiplePlayers(
        1,
        [{ playerId: 100 }], // No playerName
        "You scored!",
      )

      // Should NOT prepend player name
      expect(mockRconCommand.execute).toHaveBeenCalledWith(
        1,
        [100],
        "You scored!",
        expect.objectContaining({ forceSingle: true }),
      )
    })

    it("should send generic message for multiple players even with names", async () => {
      vi.mocked(mockCommandResolver.supportsBatch).mockResolvedValueOnce(false)
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValueOnce("say")

      await service.notifyMultiplePlayers(
        1,
        [
          { playerId: 100, playerName: "Player1" },
          { playerId: 200, playerName: "Player2" },
        ],
        "Round starting!",
      )

      // Multiple players - should use generic message
      expect(mockRconCommand.execute).toHaveBeenCalledWith(
        1,
        [100, 200],
        "Round starting!",
        expect.objectContaining({ forceSingle: true }),
      )
    })

    it("should send generic message when includePlayerName is false", async () => {
      vi.mocked(mockCommandResolver.supportsBatch).mockResolvedValueOnce(false)
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValueOnce("say")

      await service.notifyMultiplePlayers(
        1,
        [{ playerId: 100, playerName: "Player1" }],
        "You scored!",
        { includePlayerName: false },
      )

      // includePlayerName=false, so no name prefix
      expect(mockRconCommand.execute).toHaveBeenCalledWith(
        1,
        [100],
        "You scored!",
        expect.objectContaining({ forceSingle: true }),
      )
    })

    it("should pass batchDelay through for generic public messages", async () => {
      vi.mocked(mockCommandResolver.supportsBatch).mockResolvedValueOnce(false)
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValueOnce("say")

      await service.notifyMultiplePlayers(1, [{ playerId: 100 }, { playerId: 200 }], "Hello", {
        batchDelay: 50,
      })

      expect(mockRconCommand.execute).toHaveBeenCalledWith(
        1,
        [100, 200],
        "Hello",
        expect.objectContaining({
          batchDelay: 50,
          forceSingle: true,
        }),
      )
    })
  })

  describe("executeWithRetry (private, tested via notifyMultiplePlayers)", () => {
    it("should succeed on first attempt without retry", async () => {
      vi.mocked(mockCommandResolver.supportsBatch).mockResolvedValueOnce(true)

      await service.notifyMultiplePlayers(1, [{ playerId: 100 }], "Hello", { maxRetries: 3 })

      expect(mockRconCommand.execute).toHaveBeenCalledTimes(1)
    })

    it("should retry and eventually succeed", async () => {
      vi.useFakeTimers()

      vi.mocked(mockCommandResolver.supportsBatch).mockResolvedValueOnce(true)
      vi.mocked(mockRconCommand.execute)
        .mockRejectedValueOnce(new Error("Fail 1"))
        .mockRejectedValueOnce(new Error("Fail 2"))
        .mockResolvedValueOnce(undefined)

      const promise = service.notifyMultiplePlayers(1, [{ playerId: 100 }], "Hello", {
        maxRetries: 3,
      })

      // Advance timers for retry delays
      await vi.advanceTimersByTimeAsync(5000)
      await promise

      expect(mockRconCommand.execute).toHaveBeenCalledTimes(3)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Command execution failed, retrying (1/3)"),
      )
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Command execution failed, retrying (2/3)"),
      )

      vi.useRealTimers()
    })

    it("should throw last error after all retries exhausted", async () => {
      vi.mocked(mockCommandResolver.supportsBatch).mockResolvedValueOnce(true)
      vi.mocked(mockRconCommand.execute)
        .mockRejectedValueOnce(new Error("Fail 1"))
        .mockRejectedValueOnce(new Error("Fail 2"))

      // Use real timers but with a short delay override - the retry delay is 1000*attempt
      // The outer notifyMultiplePlayers catches and re-throws, so we expect the rejection
      await expect(
        service.notifyMultiplePlayers(1, [{ playerId: 100 }], "Hello", { maxRetries: 2 }),
      ).rejects.toThrow("Fail 2")

      expect(mockRconCommand.execute).toHaveBeenCalledTimes(2)
    })
  })

  describe("clearCache", () => {
    it("should delegate to commandResolver.clearCache", () => {
      service.clearCache()

      expect(mockCommandResolver.clearCache).toHaveBeenCalled()
    })
  })

  describe("clearServerCache", () => {
    it("should delegate to commandResolver.clearServerCache", () => {
      service.clearServerCache(5)

      expect(mockCommandResolver.clearServerCache).toHaveBeenCalledWith(5)
    })
  })

  describe("hasPrivateMessagingCommand (private, tested via notifyMultiplePlayers)", () => {
    it("should identify psay as private messaging", async () => {
      vi.mocked(mockCommandResolver.supportsBatch).mockResolvedValueOnce(false)
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValueOnce("hlx_amx_psay")

      await service.notifyMultiplePlayers(1, [{ playerId: 100 }], "Hello")

      // Should have used private messaging path (execute without forceSingle)
      expect(mockRconCommand.execute).toHaveBeenCalledWith(
        1,
        [100],
        "Hello",
        expect.objectContaining({
          commandType: "BroadCastEventsCommand",
        }),
      )
    })

    it("should identify tell as private messaging", async () => {
      vi.mocked(mockCommandResolver.supportsBatch).mockResolvedValueOnce(false)
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValueOnce("amx_tell")

      await service.notifyMultiplePlayers(1, [{ playerId: 100 }], "Hello")

      // Private messaging path
      expect(mockRconCommand.execute).toHaveBeenCalledWith(
        1,
        [100],
        "Hello",
        expect.not.objectContaining({ forceSingle: true }),
      )
    })

    it("should identify pm as private messaging", async () => {
      vi.mocked(mockCommandResolver.supportsBatch).mockResolvedValueOnce(false)
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValueOnce("some_pm_command")

      await service.notifyMultiplePlayers(1, [{ playerId: 100 }], "Hello")

      expect(mockRconCommand.execute).toHaveBeenCalledWith(
        1,
        [100],
        "Hello",
        expect.not.objectContaining({ forceSingle: true }),
      )
    })

    it("should return false for 'say' command even though it doesn't contain private keywords", async () => {
      vi.mocked(mockCommandResolver.supportsBatch).mockResolvedValueOnce(false)
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValueOnce("say")

      await service.notifyMultiplePlayers(1, [{ playerId: 100 }, { playerId: 200 }], "Hello")

      // Should use public messaging path (forceSingle=true)
      expect(mockRconCommand.execute).toHaveBeenCalledWith(
        1,
        [100, 200],
        "Hello",
        expect.objectContaining({ forceSingle: true }),
      )
    })

    it("should return false and log warning when getCommand fails", async () => {
      vi.mocked(mockCommandResolver.supportsBatch).mockResolvedValueOnce(false)
      vi.mocked(mockCommandResolver.getCommand).mockRejectedValueOnce(new Error("Resolver fail"))

      await service.notifyMultiplePlayers(1, [{ playerId: 100 }, { playerId: 200 }], "Hello")

      // Should fall through to public messaging since hasPrivateMessaging returned false
      expect(mockRconCommand.execute).toHaveBeenCalledWith(
        1,
        [100, 200],
        "Hello",
        expect.objectContaining({ forceSingle: true }),
      )
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Failed to check private messaging"),
        expect.objectContaining({ serverId: 1 }),
      )
    })
  })
})
