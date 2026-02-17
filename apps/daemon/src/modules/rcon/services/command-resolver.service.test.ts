/**
 * CommandResolverService Tests
 *
 * Comprehensive tests covering all branches of command resolution,
 * caching, capabilities determination, and cache management.
 */

import type { IServerRepository } from "@/modules/server/server.types"
import type { ILogger } from "@/shared/utils/logger.types"
import { createMockLogger } from "@/tests/mocks/logger"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { CommandResolverService } from "./command-resolver.service"

describe("CommandResolverService", () => {
  let service: CommandResolverService
  let mockLogger: ILogger
  let mockServerRepository: IServerRepository

  beforeEach(() => {
    vi.clearAllMocks()

    mockLogger = createMockLogger()

    mockServerRepository = {
      findById: vi.fn(),
      findByAddress: vi.fn(),
      getServerConfig: vi.fn().mockResolvedValue(null),
      hasRconCredentials: vi.fn(),
      findActiveServersWithRcon: vi.fn(),
      findServersByIds: vi.fn(),
      findAllServersWithRcon: vi.fn(),
      updateServerStatusFromRcon: vi.fn(),
      resetMapStats: vi.fn(),
      getModDefault: vi.fn().mockResolvedValue(null),
      getServerConfigDefault: vi.fn().mockResolvedValue(null),
    }

    service = new CommandResolverService(mockServerRepository, mockLogger)
  })

  describe("getCommand", () => {
    it("should return server-specific command when found", async () => {
      vi.mocked(mockServerRepository.getServerConfig).mockResolvedValueOnce("hlx_sm_psay")

      const result = await service.getCommand(1, "BroadCastEventsCommand")

      expect(result).toBe("hlx_sm_psay")
      expect(mockServerRepository.getServerConfig).toHaveBeenCalledWith(1, "BroadCastEventsCommand")
    })

    it("should return cached command on subsequent calls", async () => {
      vi.mocked(mockServerRepository.getServerConfig).mockResolvedValueOnce("hlx_sm_psay")

      await service.getCommand(1, "BroadCastEventsCommand")
      const result = await service.getCommand(1, "BroadCastEventsCommand")

      expect(result).toBe("hlx_sm_psay")
      // Only called once because second call uses cache
      expect(mockServerRepository.getServerConfig).toHaveBeenCalledTimes(1)
    })

    it("should skip server config when it returns empty string", async () => {
      vi.mocked(mockServerRepository.getServerConfig)
        .mockResolvedValueOnce("   ") // server config returns whitespace
        .mockResolvedValueOnce("csgo") // Mod type

      vi.mocked(mockServerRepository.getModDefault).mockResolvedValueOnce("hlx_amx_psay")

      const result = await service.getCommand(1, "PlayerEventsCommand")

      expect(result).toBe("hlx_amx_psay")
    })

    it("should skip server config when it returns null", async () => {
      vi.mocked(mockServerRepository.getServerConfig)
        .mockResolvedValueOnce(null) // server config returns null
        .mockResolvedValueOnce("cstrike") // Mod type

      vi.mocked(mockServerRepository.getModDefault).mockResolvedValueOnce("amx_psay")

      const result = await service.getCommand(1, "PlayerEventsCommand")

      expect(result).toBe("amx_psay")
    })

    it("should check MOD defaults when server config is not found", async () => {
      vi.mocked(mockServerRepository.getServerConfig)
        .mockResolvedValueOnce(null) // No server-specific config
        .mockResolvedValueOnce("cstrike") // Mod type

      vi.mocked(mockServerRepository.getModDefault).mockResolvedValueOnce("hlx_amx_psay")

      const result = await service.getCommand(1, "PlayerEventsCommand")

      expect(result).toBe("hlx_amx_psay")
      expect(mockServerRepository.getModDefault).toHaveBeenCalledWith(
        "cstrike",
        "PlayerEventsCommand",
      )
    })

    it("should skip MOD defaults when MOD type is null", async () => {
      vi.mocked(mockServerRepository.getServerConfig)
        .mockResolvedValueOnce(null) // No server-specific config
        .mockResolvedValueOnce(null) // No Mod type

      vi.mocked(mockServerRepository.getServerConfigDefault).mockResolvedValueOnce("say")

      const result = await service.getCommand(1, "BroadCastEventsCommand")

      expect(result).toBe("say")
      expect(mockServerRepository.getModDefault).not.toHaveBeenCalled()
    })

    it("should skip MOD defaults when MOD type is empty string", async () => {
      vi.mocked(mockServerRepository.getServerConfig)
        .mockResolvedValueOnce(null) // No server-specific config
        .mockResolvedValueOnce("  ") // Whitespace-only Mod type

      vi.mocked(mockServerRepository.getServerConfigDefault).mockResolvedValueOnce("hlx_event")

      const result = await service.getCommand(1, "BroadCastEventsCommand")

      expect(result).toBe("hlx_event")
      expect(mockServerRepository.getModDefault).not.toHaveBeenCalled()
    })

    it("should skip MOD defaults when mod command is null", async () => {
      vi.mocked(mockServerRepository.getServerConfig)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce("cstrike")

      vi.mocked(mockServerRepository.getModDefault).mockResolvedValueOnce(null)
      vi.mocked(mockServerRepository.getServerConfigDefault).mockResolvedValueOnce("global_cmd")

      const result = await service.getCommand(1, "BroadCastEventsCommand")

      expect(result).toBe("global_cmd")
    })

    it("should skip MOD defaults when mod command is empty", async () => {
      vi.mocked(mockServerRepository.getServerConfig)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce("cstrike")

      vi.mocked(mockServerRepository.getModDefault).mockResolvedValueOnce("  ")
      vi.mocked(mockServerRepository.getServerConfigDefault).mockResolvedValueOnce("global_cmd")

      const result = await service.getCommand(1, "BroadCastEventsCommand")

      expect(result).toBe("global_cmd")
    })

    it("should check global defaults when MOD defaults are not found", async () => {
      vi.mocked(mockServerRepository.getServerConfig)
        .mockResolvedValueOnce(null) // No server config
        .mockResolvedValueOnce("cstrike") // Mod type

      vi.mocked(mockServerRepository.getModDefault).mockResolvedValueOnce(null) // No mod default
      vi.mocked(mockServerRepository.getServerConfigDefault).mockResolvedValueOnce("hlx_event")

      const result = await service.getCommand(1, "BroadCastEventsCommand")

      expect(result).toBe("hlx_event")
      expect(mockServerRepository.getServerConfigDefault).toHaveBeenCalledWith(
        "BroadCastEventsCommand",
      )
    })

    it("should skip global default when it returns null", async () => {
      vi.mocked(mockServerRepository.getServerConfig)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)

      vi.mocked(mockServerRepository.getServerConfigDefault).mockResolvedValueOnce(null)

      const result = await service.getCommand(1, "BroadCastEventsCommand")

      expect(result).toBe("say")
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Using fallback command"),
        expect.objectContaining({
          serverId: 1,
          commandType: "BroadCastEventsCommand",
          command: "say",
        }),
      )
    })

    it("should skip global default when it returns empty string", async () => {
      vi.mocked(mockServerRepository.getServerConfig)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)

      vi.mocked(mockServerRepository.getServerConfigDefault).mockResolvedValueOnce("  ")

      const result = await service.getCommand(1, "BroadCastEventsCommand")

      expect(result).toBe("say")
    })

    it("should fall back to 'say' when no config is found at any level", async () => {
      const result = await service.getCommand(99, "PlayerEventsCommand")

      expect(result).toBe("say")
      expect(mockLogger.debug).toHaveBeenCalled()
    })

    it("should return 'say' on error and log the error with Error instance", async () => {
      vi.mocked(mockServerRepository.getServerConfig).mockRejectedValueOnce(
        new Error("DB connection failed"),
      )

      const result = await service.getCommand(1, "BroadCastEventsCommand")

      expect(result).toBe("say")
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to resolve command for server 1"),
        expect.objectContaining({
          serverId: 1,
          commandType: "BroadCastEventsCommand",
          error: "DB connection failed",
        }),
      )
    })

    it("should return 'say' on error and stringify non-Error objects", async () => {
      vi.mocked(mockServerRepository.getServerConfig).mockRejectedValueOnce("string error")

      const result = await service.getCommand(1, "BroadCastEventsCommand")

      expect(result).toBe("say")
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to resolve command"),
        expect.objectContaining({
          error: "string error",
        }),
      )
    })

    it("should cache the fallback 'say' command", async () => {
      // First call falls through to fallback
      await service.getCommand(1, "BroadCastEventsCommand")
      // Second call should use cache
      const result = await service.getCommand(1, "BroadCastEventsCommand")

      expect(result).toBe("say")
      // getServerConfig only called once for the command lookup (first call)
      expect(mockServerRepository.getServerConfig).toHaveBeenCalledTimes(2) // once for config, once for mod
    })

    it("should handle different command types independently", async () => {
      vi.mocked(mockServerRepository.getServerConfig)
        .mockResolvedValueOnce("hlx_sm_psay") // BroadCast
        .mockResolvedValueOnce("hlx_amx_psay") // Player

      const result1 = await service.getCommand(1, "BroadCastEventsCommand")
      const result2 = await service.getCommand(1, "PlayerEventsCommand")

      expect(result1).toBe("hlx_sm_psay")
      expect(result2).toBe("hlx_amx_psay")
    })

    it("should handle different servers independently", async () => {
      vi.mocked(mockServerRepository.getServerConfig)
        .mockResolvedValueOnce("hlx_sm_psay") // server 1
        .mockResolvedValueOnce("amx_psay") // server 2

      const result1 = await service.getCommand(1, "BroadCastEventsCommand")
      const result2 = await service.getCommand(2, "BroadCastEventsCommand")

      expect(result1).toBe("hlx_sm_psay")
      expect(result2).toBe("amx_psay")
    })
  })

  describe("getCommandCapabilities", () => {
    it("should return capabilities for batch command and cache them", async () => {
      vi.mocked(mockServerRepository.getServerConfig).mockResolvedValueOnce("hlx_sm_psay")

      const result = await service.getCommandCapabilities(1, "BroadCastEventsCommand")

      expect(result).toEqual({
        supportsBatch: true,
        maxBatchSize: 32,
        requiresHashPrefix: false,
      })

      // Second call should use cache
      const result2 = await service.getCommandCapabilities(1, "BroadCastEventsCommand")
      expect(result2).toEqual(result)
    })

    it("should return cached capabilities on subsequent calls", async () => {
      vi.mocked(mockServerRepository.getServerConfig).mockResolvedValueOnce("hlx_sm_psay")

      await service.getCommandCapabilities(1, "BroadCastEventsCommand")
      await service.getCommandCapabilities(1, "BroadCastEventsCommand")

      // getServerConfig should only be called once (first time)
      expect(mockServerRepository.getServerConfig).toHaveBeenCalledTimes(1)
    })
  })

  describe("supportsBatch", () => {
    it("should return true for batch-capable commands", async () => {
      vi.mocked(mockServerRepository.getServerConfig).mockResolvedValueOnce("hlx_sm_psay")

      const result = await service.supportsBatch(1, "BroadCastEventsCommand")

      expect(result).toBe(true)
    })

    it("should return false for non-batch commands", async () => {
      vi.mocked(mockServerRepository.getServerConfig).mockResolvedValueOnce("hlx_amx_psay")

      const result = await service.supportsBatch(1, "BroadCastEventsCommand")

      expect(result).toBe(false)
    })
  })

  describe("getBatchLimit", () => {
    it("should return batch limit for batch-capable commands", async () => {
      vi.mocked(mockServerRepository.getServerConfig).mockResolvedValueOnce("hlx_amx_bulkpsay")

      const result = await service.getBatchLimit(1, "BroadCastEventsCommand")

      expect(result).toBe(8)
    })

    it("should return 1 for non-batch commands", async () => {
      vi.mocked(mockServerRepository.getServerConfig).mockResolvedValueOnce("say")

      const result = await service.getBatchLimit(1, "BroadCastEventsCommand")

      expect(result).toBe(1)
    })
  })

  describe("determineCapabilities (private, tested via getCommandCapabilities)", () => {
    it("should identify hlx_amx_bulkpsay as batch with hash prefix", async () => {
      vi.mocked(mockServerRepository.getServerConfig).mockResolvedValueOnce("hlx_amx_bulkpsay")

      const caps = await service.getCommandCapabilities(1, "BroadCastEventsCommand")

      expect(caps).toEqual({
        supportsBatch: true,
        maxBatchSize: 8,
        requiresHashPrefix: true,
      })
    })

    it("should identify amx_bulkpsay as batch with hash prefix", async () => {
      vi.mocked(mockServerRepository.getServerConfig).mockResolvedValueOnce("amx_bulkpsay")

      const caps = await service.getCommandCapabilities(1, "BroadCastEventsCommand")

      expect(caps).toEqual({
        supportsBatch: true,
        maxBatchSize: 8,
        requiresHashPrefix: true,
      })
    })

    it("should identify hlx_sm_psay as batch without hash prefix", async () => {
      vi.mocked(mockServerRepository.getServerConfig).mockResolvedValueOnce("hlx_sm_psay")

      const caps = await service.getCommandCapabilities(1, "BroadCastEventsCommand")

      expect(caps).toEqual({
        supportsBatch: true,
        maxBatchSize: 32,
        requiresHashPrefix: false,
      })
    })

    it("should identify hlx_amx_psay as individual with hash prefix", async () => {
      vi.mocked(mockServerRepository.getServerConfig).mockResolvedValueOnce("hlx_amx_psay")

      const caps = await service.getCommandCapabilities(1, "BroadCastEventsCommand")

      expect(caps).toEqual({
        supportsBatch: false,
        maxBatchSize: 1,
        requiresHashPrefix: true,
      })
    })

    it("should identify ms_psay as individual without hash prefix", async () => {
      vi.mocked(mockServerRepository.getServerConfig).mockResolvedValueOnce("ms_psay")

      const caps = await service.getCommandCapabilities(1, "BroadCastEventsCommand")

      expect(caps).toEqual({
        supportsBatch: false,
        maxBatchSize: 1,
        requiresHashPrefix: false,
      })
    })

    it("should identify hlx_psay as individual without hash prefix", async () => {
      vi.mocked(mockServerRepository.getServerConfig).mockResolvedValueOnce("hlx_psay")

      const caps = await service.getCommandCapabilities(1, "BroadCastEventsCommand")

      expect(caps).toEqual({
        supportsBatch: false,
        maxBatchSize: 1,
        requiresHashPrefix: false,
      })
    })

    it("should identify ma_hlx_psay as individual without hash prefix", async () => {
      vi.mocked(mockServerRepository.getServerConfig).mockResolvedValueOnce("ma_hlx_psay")

      const caps = await service.getCommandCapabilities(1, "BroadCastEventsCommand")

      expect(caps).toEqual({
        supportsBatch: false,
        maxBatchSize: 1,
        requiresHashPrefix: false,
      })
    })

    it("should identify amx_psay as individual with hash prefix", async () => {
      vi.mocked(mockServerRepository.getServerConfig).mockResolvedValueOnce("amx_psay")

      const caps = await service.getCommandCapabilities(1, "BroadCastEventsCommand")

      expect(caps).toEqual({
        supportsBatch: false,
        maxBatchSize: 1,
        requiresHashPrefix: true,
      })
    })

    it("should identify amx_say as individual with hash prefix", async () => {
      vi.mocked(mockServerRepository.getServerConfig).mockResolvedValueOnce("amx_say")

      const caps = await service.getCommandCapabilities(1, "BroadCastEventsCommand")

      expect(caps).toEqual({
        supportsBatch: false,
        maxBatchSize: 1,
        requiresHashPrefix: true,
      })
    })

    it("should identify amx_tell as individual with hash prefix", async () => {
      vi.mocked(mockServerRepository.getServerConfig).mockResolvedValueOnce("amx_tell")

      const caps = await service.getCommandCapabilities(1, "BroadCastEventsCommand")

      expect(caps).toEqual({
        supportsBatch: false,
        maxBatchSize: 1,
        requiresHashPrefix: true,
      })
    })

    it("should identify amx_pm as individual with hash prefix", async () => {
      vi.mocked(mockServerRepository.getServerConfig).mockResolvedValueOnce("amx_pm")

      const caps = await service.getCommandCapabilities(1, "BroadCastEventsCommand")

      expect(caps).toEqual({
        supportsBatch: false,
        maxBatchSize: 1,
        requiresHashPrefix: true,
      })
    })

    it("should identify 'say' as vanilla with no batch and no hash prefix", async () => {
      vi.mocked(mockServerRepository.getServerConfig).mockResolvedValueOnce("say")

      const caps = await service.getCommandCapabilities(1, "BroadCastEventsCommand")

      expect(caps).toEqual({
        supportsBatch: false,
        maxBatchSize: 1,
        requiresHashPrefix: false,
      })
    })

    it("should identify unknown commands as vanilla", async () => {
      vi.mocked(mockServerRepository.getServerConfig).mockResolvedValueOnce("custom_plugin_cmd")

      const caps = await service.getCommandCapabilities(1, "BroadCastEventsCommand")

      expect(caps).toEqual({
        supportsBatch: false,
        maxBatchSize: 1,
        requiresHashPrefix: false,
      })
    })
  })

  describe("clearCache", () => {
    it("should clear both command and capabilities caches", async () => {
      vi.mocked(mockServerRepository.getServerConfig).mockResolvedValue("hlx_sm_psay")

      // Populate caches
      await service.getCommand(1, "BroadCastEventsCommand")
      // getCommand calls getServerConfig once (returns "hlx_sm_psay" on first call, no mod lookup)
      const callsBeforeClear = vi.mocked(mockServerRepository.getServerConfig).mock.calls.length

      // getCommandCapabilities calls getCommand internally, which uses cache
      await service.getCommandCapabilities(1, "BroadCastEventsCommand")
      expect(vi.mocked(mockServerRepository.getServerConfig).mock.calls.length).toBe(
        callsBeforeClear,
      ) // Still cached

      service.clearCache()

      // After clearing, should fetch from repository again
      await service.getCommand(1, "BroadCastEventsCommand")
      expect(vi.mocked(mockServerRepository.getServerConfig).mock.calls.length).toBe(
        callsBeforeClear + 1,
      )

      // Capabilities cache is also cleared, so calling again should re-fetch (getCommand is cached again by now)
      await service.getCommandCapabilities(1, "BroadCastEventsCommand")
      // getCommand is re-cached from the previous call, so no additional fetch
      expect(vi.mocked(mockServerRepository.getServerConfig).mock.calls.length).toBe(
        callsBeforeClear + 1,
      )
    })
  })

  describe("clearServerCache", () => {
    it("should clear caches only for the specified server", async () => {
      vi.mocked(mockServerRepository.getServerConfig)
        .mockResolvedValueOnce("hlx_sm_psay") // server 1
        .mockResolvedValueOnce("amx_psay") // server 2

      await service.getCommand(1, "BroadCastEventsCommand")
      await service.getCommand(2, "BroadCastEventsCommand")

      // Also populate capabilities cache
      await service.getCommandCapabilities(1, "BroadCastEventsCommand")
      await service.getCommandCapabilities(2, "BroadCastEventsCommand")

      service.clearServerCache(1)

      // Server 1 should need to refetch
      vi.mocked(mockServerRepository.getServerConfig).mockResolvedValueOnce("hlx_sm_psay_v2")
      const result1 = await service.getCommand(1, "BroadCastEventsCommand")
      expect(result1).toBe("hlx_sm_psay_v2")

      // Server 2 should still use cache
      const result2 = await service.getCommand(2, "BroadCastEventsCommand")
      expect(result2).toBe("amx_psay")
    })

    it("should not throw when clearing cache for a server with no cached data", () => {
      expect(() => service.clearServerCache(999)).not.toThrow()
    })
  })
})
