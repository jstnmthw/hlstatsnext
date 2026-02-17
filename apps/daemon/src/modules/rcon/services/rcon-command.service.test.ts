/**
 * RconCommandService Tests
 *
 * Comprehensive tests covering execute, executeRaw, executeAnnouncement,
 * batch vs individual execution, message escaping, and error handling.
 */

import type { IPlayerSessionService } from "@/modules/player/types/player-session.types"
import type { ILogger } from "@/shared/utils/logger.types"
import { createMockLogger } from "@/tests/mocks/logger"
import { createMockRconService } from "@/tests/mocks/rcon.service.mock"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { IRconService } from "../types/rcon.types"
import type { CommandResolverService } from "./command-resolver.service"
import { RconCommandService } from "./rcon-command.service"

describe("RconCommandService", () => {
  let service: RconCommandService
  let mockLogger: ILogger
  let mockRconService: IRconService
  let mockCommandResolver: CommandResolverService
  let mockSessionService: IPlayerSessionService

  beforeEach(() => {
    vi.clearAllMocks()

    mockLogger = createMockLogger()
    mockRconService = createMockRconService()

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

    service = new RconCommandService(
      mockRconService,
      mockCommandResolver as CommandResolverService,
      mockSessionService,
      mockLogger,
    )
  })

  describe("execute", () => {
    it("should return immediately when recipients array is empty", async () => {
      await service.execute(1, [], "Hello")

      expect(mockSessionService.convertToGameUserIds).not.toHaveBeenCalled()
      expect(mockRconService.executeCommand).not.toHaveBeenCalled()
    })

    it("should return when no valid game user IDs are found", async () => {
      vi.mocked(mockSessionService.convertToGameUserIds).mockResolvedValueOnce([])

      await service.execute(1, [100, 200], "Hello")

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("No valid game user IDs"),
        expect.objectContaining({ serverId: 1, recipients: [100, 200] }),
      )
      expect(mockRconService.executeCommand).not.toHaveBeenCalled()
    })

    it("should use default commandType 'BroadCastEventsCommand' when not specified", async () => {
      vi.mocked(mockSessionService.convertToGameUserIds).mockResolvedValueOnce([10])

      await service.execute(1, [100], "Hello")

      expect(mockCommandResolver.getCommandCapabilities).toHaveBeenCalledWith(
        1,
        "BroadCastEventsCommand",
      )
    })

    it("should use specified commandType from options", async () => {
      vi.mocked(mockSessionService.convertToGameUserIds).mockResolvedValueOnce([10])

      await service.execute(1, [100], "Hello", { commandType: "PlayerEventsCommand" })

      expect(mockCommandResolver.getCommandCapabilities).toHaveBeenCalledWith(
        1,
        "PlayerEventsCommand",
      )
    })

    it("should use batch execution when capabilities support batch", async () => {
      vi.mocked(mockSessionService.convertToGameUserIds).mockResolvedValueOnce([10, 20, 30])
      vi.mocked(mockCommandResolver.getCommandCapabilities).mockResolvedValueOnce({
        supportsBatch: true,
        maxBatchSize: 32,
        requiresHashPrefix: false,
      })
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValue("hlx_sm_psay")

      await service.execute(1, [100, 200, 300], "Hello")

      expect(mockRconService.executeCommand).toHaveBeenCalledWith(
        1,
        expect.stringContaining("hlx_sm_psay"),
      )
    })

    it("should use individual execution when forceSingle is true", async () => {
      vi.mocked(mockSessionService.convertToGameUserIds).mockResolvedValueOnce([10])
      vi.mocked(mockCommandResolver.getCommandCapabilities).mockResolvedValueOnce({
        supportsBatch: true,
        maxBatchSize: 32,
        requiresHashPrefix: false,
      })
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValue("say")

      await service.execute(1, [100], "Hello", { forceSingle: true })

      // Should execute individually despite batch support
      expect(mockRconService.executeCommand).toHaveBeenCalledWith(
        1,
        expect.stringContaining("say 10 Hello"),
      )
    })

    it("should use individual execution when capabilities do not support batch", async () => {
      vi.mocked(mockSessionService.convertToGameUserIds).mockResolvedValueOnce([10])
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValue("say")

      await service.execute(1, [100], "Hello")

      expect(mockRconService.executeCommand).toHaveBeenCalledWith(1, "say 10 Hello")
    })

    it("should throw on error and log it with Error instance", async () => {
      vi.mocked(mockSessionService.convertToGameUserIds).mockRejectedValueOnce(
        new Error("Session error"),
      )

      await expect(service.execute(1, [100], "Hello")).rejects.toThrow("Session error")

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to execute RCON command"),
        expect.objectContaining({
          serverId: 1,
          commandType: "BroadCastEventsCommand",
          error: "Session error",
        }),
      )
    })

    it("should throw on error and stringify non-Error objects", async () => {
      vi.mocked(mockSessionService.convertToGameUserIds).mockRejectedValueOnce("network failure")

      await expect(service.execute(1, [100], "Hello")).rejects.toBe("network failure")

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to execute RCON command"),
        expect.objectContaining({
          error: "network failure",
        }),
      )
    })

    it("should log debug message after successful execution", async () => {
      vi.mocked(mockSessionService.convertToGameUserIds).mockResolvedValueOnce([10])
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValue("say")

      await service.execute(1, [100], "Hello")

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Executed RCON command for 1 recipients"),
        expect.objectContaining({
          serverId: 1,
          commandType: "BroadCastEventsCommand",
          recipientCount: 1,
          batchMode: false,
        }),
      )
    })
  })

  describe("executeRaw", () => {
    it("should execute raw RCON command", async () => {
      await service.executeRaw(1, "status")

      expect(mockRconService.executeCommand).toHaveBeenCalledWith(1, "status")
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Executed raw RCON command"),
        expect.objectContaining({ serverId: 1, command: "status" }),
      )
    })

    it("should truncate long commands in logs", async () => {
      const longCommand = "a".repeat(200)
      await service.executeRaw(1, longCommand)

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          command: longCommand.substring(0, 100),
        }),
      )
    })

    it("should throw on error and log with Error instance", async () => {
      vi.mocked(mockRconService.executeCommand).mockRejectedValueOnce(new Error("Connection lost"))

      await expect(service.executeRaw(1, "status")).rejects.toThrow("Connection lost")

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to execute raw RCON command"),
        expect.objectContaining({
          serverId: 1,
          error: "Connection lost",
        }),
      )
    })

    it("should throw on error and stringify non-Error objects", async () => {
      vi.mocked(mockRconService.executeCommand).mockRejectedValueOnce(42)

      await expect(service.executeRaw(1, "status")).rejects.toBe(42)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ error: "42" }),
      )
    })
  })

  describe("executeBatch (private, tested via execute)", () => {
    it("should use SourceMod comma-separated format for hlx_sm_psay", async () => {
      vi.mocked(mockSessionService.convertToGameUserIds).mockResolvedValueOnce([10, 20, 30])
      vi.mocked(mockCommandResolver.getCommandCapabilities).mockResolvedValueOnce({
        supportsBatch: true,
        maxBatchSize: 32,
        requiresHashPrefix: false,
      })
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValue("hlx_sm_psay")

      await service.execute(1, [100, 200, 300], "Test message")

      expect(mockRconService.executeCommand).toHaveBeenCalledWith(
        1,
        "hlx_sm_psay 10,20,30 Test message",
      )
    })

    it("should use AMX bulk format with hash prefix for hlx_amx_bulkpsay", async () => {
      vi.mocked(mockSessionService.convertToGameUserIds).mockResolvedValueOnce([10, 20])
      vi.mocked(mockCommandResolver.getCommandCapabilities).mockResolvedValueOnce({
        supportsBatch: true,
        maxBatchSize: 8,
        requiresHashPrefix: true,
      })
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValue("hlx_amx_bulkpsay")

      await service.execute(1, [100, 200], "Bulk message")

      expect(mockRconService.executeCommand).toHaveBeenCalledWith(
        1,
        "hlx_amx_bulkpsay #10 #20 Bulk message",
      )
    })

    it("should fall back to individual execution for unknown batch commands", async () => {
      vi.mocked(mockSessionService.convertToGameUserIds).mockResolvedValueOnce([10, 20])
      vi.mocked(mockCommandResolver.getCommandCapabilities).mockResolvedValueOnce({
        supportsBatch: true,
        maxBatchSize: 8,
        requiresHashPrefix: false,
      })
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValue("custom_batch_cmd")

      await service.execute(1, [100, 200], "Test")

      // Should have called executeCommand for each recipient individually
      expect(mockRconService.executeCommand).toHaveBeenCalledTimes(2)
      expect(mockRconService.executeCommand).toHaveBeenCalledWith(1, "custom_batch_cmd 10 Test")
      expect(mockRconService.executeCommand).toHaveBeenCalledWith(1, "custom_batch_cmd 20 Test")
    })

    it("should split recipients into batches when exceeding max batch size", async () => {
      const gameUserIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      vi.mocked(mockSessionService.convertToGameUserIds).mockResolvedValueOnce(gameUserIds)
      vi.mocked(mockCommandResolver.getCommandCapabilities).mockResolvedValueOnce({
        supportsBatch: true,
        maxBatchSize: 4,
        requiresHashPrefix: false,
      })
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValue("hlx_sm_psay")

      await service.execute(1, Array(10).fill(100), "Hello")

      // 10 recipients / 4 batch size = 3 batches (4, 4, 2)
      expect(mockRconService.executeCommand).toHaveBeenCalledTimes(3)
      expect(mockRconService.executeCommand).toHaveBeenCalledWith(1, "hlx_sm_psay 1,2,3,4 Hello")
      expect(mockRconService.executeCommand).toHaveBeenCalledWith(1, "hlx_sm_psay 5,6,7,8 Hello")
      expect(mockRconService.executeCommand).toHaveBeenCalledWith(1, "hlx_sm_psay 9,10 Hello")
    })
  })

  describe("executeIndividual (private, tested via execute)", () => {
    it("should add hash prefix when requiresHashPrefix is true", async () => {
      vi.mocked(mockSessionService.convertToGameUserIds).mockResolvedValueOnce([10])
      vi.mocked(mockCommandResolver.getCommandCapabilities).mockResolvedValueOnce({
        supportsBatch: false,
        maxBatchSize: 1,
        requiresHashPrefix: true,
      })
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValue("amx_psay")

      await service.execute(1, [100], "Hello")

      expect(mockRconService.executeCommand).toHaveBeenCalledWith(1, "amx_psay #10 Hello")
    })

    it("should not add hash prefix when requiresHashPrefix is false", async () => {
      vi.mocked(mockSessionService.convertToGameUserIds).mockResolvedValueOnce([10])
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValue("say")

      await service.execute(1, [100], "Hello")

      expect(mockRconService.executeCommand).toHaveBeenCalledWith(1, "say 10 Hello")
    })

    it("should add delay between commands when batchDelay is specified and multiple recipients", async () => {
      vi.useFakeTimers()
      vi.mocked(mockSessionService.convertToGameUserIds).mockResolvedValueOnce([10, 20])
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValue("say")

      const executePromise = service.execute(1, [100, 200], "Hello", { batchDelay: 100 })

      // Advance timers to allow delays to resolve
      await vi.advanceTimersByTimeAsync(200)
      await executePromise

      expect(mockRconService.executeCommand).toHaveBeenCalledTimes(2)

      vi.useRealTimers()
    })

    it("should not delay when batchDelay is 0", async () => {
      vi.mocked(mockSessionService.convertToGameUserIds).mockResolvedValueOnce([10, 20])
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValue("say")

      await service.execute(1, [100, 200], "Hello", { batchDelay: 0 })

      expect(mockRconService.executeCommand).toHaveBeenCalledTimes(2)
    })

    it("should not delay when there is only one recipient even with batchDelay", async () => {
      vi.mocked(mockSessionService.convertToGameUserIds).mockResolvedValueOnce([10])
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValue("say")

      await service.execute(1, [100], "Hello", { batchDelay: 100 })

      expect(mockRconService.executeCommand).toHaveBeenCalledTimes(1)
    })
  })

  describe("executeAnnouncement", () => {
    it("should handle ma_hlx_csay command with #all suffix", async () => {
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValueOnce("ma_hlx_csay")

      await service.executeAnnouncement(1, "Server announcement")

      expect(mockRconService.executeCommand).toHaveBeenCalledWith(
        1,
        "ma_hlx_csay #all Server announcement",
      )
    })

    it("should handle plain 'say' command for vanilla servers", async () => {
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValueOnce("say")

      await service.executeAnnouncement(1, "Hello everyone")

      expect(mockRconService.executeCommand).toHaveBeenCalledWith(1, "say Hello everyone")
    })

    it("should handle generic announcement commands", async () => {
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValueOnce("hlx_sm_csay")

      await service.executeAnnouncement(1, "An announcement")

      expect(mockRconService.executeCommand).toHaveBeenCalledWith(1, "hlx_sm_csay An announcement")
    })

    it("should use default commandType BroadCastEventsCommandAnnounce", async () => {
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValueOnce("say")

      await service.executeAnnouncement(1, "Hello")

      expect(mockCommandResolver.getCommand).toHaveBeenCalledWith(
        1,
        "BroadCastEventsCommandAnnounce",
      )
    })

    it("should use custom commandType when specified", async () => {
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValueOnce("say")

      await service.executeAnnouncement(1, "Hello", "PlayerEventsCommand")

      expect(mockCommandResolver.getCommand).toHaveBeenCalledWith(1, "PlayerEventsCommand")
    })

    it("should throw on error and log with Error instance", async () => {
      vi.mocked(mockCommandResolver.getCommand).mockRejectedValueOnce(new Error("Resolver error"))

      await expect(service.executeAnnouncement(1, "Hello")).rejects.toThrow("Resolver error")

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to execute announcement command"),
        expect.objectContaining({
          serverId: 1,
          error: "Resolver error",
        }),
      )
    })

    it("should throw on error and stringify non-Error objects", async () => {
      vi.mocked(mockCommandResolver.getCommand).mockRejectedValueOnce("timeout")

      await expect(service.executeAnnouncement(1, "Hello")).rejects.toBe("timeout")

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ error: "timeout" }),
      )
    })
  })

  describe("escapeMessage (private, tested via execute)", () => {
    it("should escape double quotes", async () => {
      vi.mocked(mockSessionService.convertToGameUserIds).mockResolvedValueOnce([10])
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValue("say")

      await service.execute(1, [100], 'He said "hello"')

      expect(mockRconService.executeCommand).toHaveBeenCalledWith(1, 'say 10 He said \\"hello\\"')
    })

    it("should escape newlines", async () => {
      vi.mocked(mockSessionService.convertToGameUserIds).mockResolvedValueOnce([10])
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValue("say")

      await service.execute(1, [100], "line1\nline2")

      expect(mockRconService.executeCommand).toHaveBeenCalledWith(1, "say 10 line1\\nline2")
    })

    it("should escape carriage returns", async () => {
      vi.mocked(mockSessionService.convertToGameUserIds).mockResolvedValueOnce([10])
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValue("say")

      await service.execute(1, [100], "line1\rline2")

      expect(mockRconService.executeCommand).toHaveBeenCalledWith(1, "say 10 line1\\rline2")
    })

    it("should escape semicolons", async () => {
      vi.mocked(mockSessionService.convertToGameUserIds).mockResolvedValueOnce([10])
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValue("say")

      await service.execute(1, [100], "cmd1;cmd2")

      expect(mockRconService.executeCommand).toHaveBeenCalledWith(1, "say 10 cmd1\\;cmd2")
    })

    it("should escape multiple special characters simultaneously", async () => {
      vi.mocked(mockSessionService.convertToGameUserIds).mockResolvedValueOnce([10])
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValue("say")

      await service.execute(1, [100], 'a"b\nc\r;d')

      expect(mockRconService.executeCommand).toHaveBeenCalledWith(1, 'say 10 a\\"b\\nc\\r\\;d')
    })
  })

  describe("logCommand (private, tested via execute)", () => {
    it("should truncate commands longer than 100 characters in logs", async () => {
      vi.mocked(mockSessionService.convertToGameUserIds).mockResolvedValueOnce([10])
      const longMessage = "a".repeat(200)
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValue("say")

      await service.execute(1, [100], longMessage)

      // The log should contain the truncated command with "..."
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Executing RCON command",
        expect.objectContaining({
          command: expect.stringContaining("..."),
        }),
      )
    })

    it("should show full command when under 100 characters", async () => {
      vi.mocked(mockSessionService.convertToGameUserIds).mockResolvedValueOnce([10])
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValue("say")

      await service.execute(1, [100], "Short")

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Executing RCON command",
        expect.objectContaining({
          command: expect.not.stringContaining("..."),
        }),
      )
    })

    it("should show first 5 recipients when more than 5", async () => {
      const gameIds = [1, 2, 3, 4, 5, 6, 7]
      vi.mocked(mockSessionService.convertToGameUserIds).mockResolvedValueOnce(gameIds)
      vi.mocked(mockCommandResolver.getCommandCapabilities).mockResolvedValueOnce({
        supportsBatch: true,
        maxBatchSize: 32,
        requiresHashPrefix: false,
      })
      vi.mocked(mockCommandResolver.getCommand).mockResolvedValue("hlx_sm_psay")

      await service.execute(1, Array(7).fill(100), "Hello")

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Executing RCON command",
        expect.objectContaining({
          recipients: expect.stringContaining("..."),
        }),
      )
    })
  })
})
