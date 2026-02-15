/**
 * Server Orchestrator Tests
 *
 * Tests for server finding and creation operations.
 */

import type { IServerService } from "@/modules/server/server.types"
import type { ILogger } from "@/shared/utils/logger.types"
import { createMockLogger } from "@/tests/mocks/logger"
import { createMockServerService } from "@/tests/mocks/server.service.mock"
import { beforeEach, describe, expect, it, vi } from "vitest"

describe("ServerOrchestrator", () => {
  let mockLogger: ILogger
  let mockServerService: IServerService

  beforeEach(() => {
    vi.clearAllMocks()
    mockLogger = createMockLogger()
    mockServerService = createMockServerService()
  })

  describe("getServerGame", () => {
    it("should delegate to server service", async () => {
      // Import dynamically to avoid module mocking issues
      const { ServerOrchestrator } = await import("./server-orchestrator.js")

      const mockDatabase = {
        prisma: {
          server: {
            findFirst: vi.fn().mockResolvedValue({ serverId: 1 }),
          },
        },
        transaction: vi.fn(),
      }

      const orchestrator = new ServerOrchestrator(
        mockDatabase as any,
        mockServerService,
        mockLogger,
      )

      vi.mocked(mockServerService.getServerGame).mockResolvedValue("tf")

      const result = await orchestrator.getServerGame(1)

      expect(result).toBe("tf")
      expect(mockServerService.getServerGame).toHaveBeenCalledWith(1)
    })
  })

  describe("findOrCreateServer", () => {
    it("should return existing server if found", async () => {
      const { ServerOrchestrator } = await import("./server-orchestrator.js")

      const mockDatabase = {
        prisma: {
          server: {
            findFirst: vi.fn().mockResolvedValue({
              serverId: 42,
              city: "New York",
              country: "US",
              lat: 40.7128,
              lng: -74.006,
            }),
          },
        },
        transaction: vi.fn(),
      }

      const orchestrator = new ServerOrchestrator(
        mockDatabase as any,
        mockServerService,
        mockLogger,
      )

      const result = await orchestrator.findOrCreateServer("192.168.1.1", 27015, "cstrike")

      expect(result).toEqual({ serverId: 42 })
    })

    it("should validate address", async () => {
      const { ServerOrchestrator } = await import("./server-orchestrator.js")

      const mockDatabase = {
        prisma: {
          server: {
            findFirst: vi.fn().mockResolvedValue({ serverId: 1 }),
          },
        },
        transaction: vi.fn(),
      }

      const orchestrator = new ServerOrchestrator(
        mockDatabase as any,
        mockServerService,
        mockLogger,
      )

      // Invalid address should throw
      await expect(orchestrator.findOrCreateServer("", 27015, "cstrike")).rejects.toThrow()
    })

    it("should validate port", async () => {
      const { ServerOrchestrator } = await import("./server-orchestrator.js")

      const mockDatabase = {
        prisma: {
          server: {
            findFirst: vi.fn().mockResolvedValue({ serverId: 1 }),
          },
        },
        transaction: vi.fn(),
      }

      const orchestrator = new ServerOrchestrator(
        mockDatabase as any,
        mockServerService,
        mockLogger,
      )

      // Invalid port should throw
      await expect(orchestrator.findOrCreateServer("192.168.1.1", -1, "cstrike")).rejects.toThrow()
    })

    it("should validate game code", async () => {
      const { ServerOrchestrator } = await import("./server-orchestrator.js")

      const mockDatabase = {
        prisma: {
          server: {
            findFirst: vi.fn().mockResolvedValue({ serverId: 1 }),
          },
        },
        transaction: vi.fn(),
      }

      const orchestrator = new ServerOrchestrator(
        mockDatabase as any,
        mockServerService,
        mockLogger,
      )

      // Invalid game code should throw
      await expect(orchestrator.findOrCreateServer("192.168.1.1", 27015, "")).rejects.toThrow()
    })
  })
})
