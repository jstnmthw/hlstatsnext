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

    it("should create a new server when not found", async () => {
      const { ServerOrchestrator } = await import("./server-orchestrator.js")

      const mockDatabase = {
        prisma: {
          server: {
            findFirst: vi.fn().mockResolvedValue(null), // Not found
            create: vi.fn().mockResolvedValue({
              serverId: 99,
              city: "",
              country: "",
              lat: null,
              lng: null,
            }),
          },
          serverConfigGeneral: {
            createMany: vi.fn(),
          },
        },
        transaction: vi.fn().mockImplementation(async (cb: any) =>
          cb({
            server: {
              create: vi.fn().mockResolvedValue({
                serverId: 99,
                city: "",
                country: "",
                lat: null,
                lng: null,
              }),
            },
            serverConfigGeneral: {
              createMany: vi.fn(),
            },
          }),
        ),
      }

      const orchestrator = new ServerOrchestrator(
        mockDatabase as any,
        mockServerService,
        mockLogger,
      )

      const result = await orchestrator.findOrCreateServer("10.0.0.1", 27015, "cstrike")

      expect(result.serverId).toBe(99)
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Auto-created server"))
    })

    it("should handle P2002 race condition by finding existing server", async () => {
      const { ServerOrchestrator } = await import("./server-orchestrator.js")

      const p2002Error = Object.assign(new Error("Unique constraint failed"), { code: "P2002" })

      const mockDatabase = {
        prisma: {
          server: {
            findFirst: vi
              .fn()
              .mockResolvedValueOnce(null) // First lookup - not found
              .mockResolvedValueOnce({
                // After P2002, found
                serverId: 77,
                city: "Chicago",
                country: "US",
                lat: 41.88,
                lng: -87.62,
              }),
          },
        },
        transaction: vi.fn().mockRejectedValue(p2002Error),
      }

      const orchestrator = new ServerOrchestrator(
        mockDatabase as any,
        mockServerService,
        mockLogger,
      )

      const result = await orchestrator.findOrCreateServer("10.0.0.1", 27015, "cstrike")
      expect(result.serverId).toBe(77)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Race condition detected"),
      )
    })

    it("should throw when P2002 race condition and server still not found", async () => {
      const { ServerOrchestrator } = await import("./server-orchestrator.js")

      const p2002Error = Object.assign(new Error("Unique constraint failed"), { code: "P2002" })

      const mockDatabase = {
        prisma: {
          server: {
            findFirst: vi.fn().mockResolvedValue(null), // Never found
          },
        },
        transaction: vi.fn().mockRejectedValue(p2002Error),
      }

      const orchestrator = new ServerOrchestrator(
        mockDatabase as any,
        mockServerService,
        mockLogger,
      )

      await expect(orchestrator.findOrCreateServer("10.0.0.1", 27015, "cstrike")).rejects.toThrow(
        "Failed to find or create server",
      )
    })

    it("should rethrow non-P2002 errors", async () => {
      const { ServerOrchestrator } = await import("./server-orchestrator.js")

      const genericError = new Error("Connection refused")

      const mockDatabase = {
        prisma: {
          server: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
        transaction: vi.fn().mockRejectedValue(genericError),
      }

      const orchestrator = new ServerOrchestrator(
        mockDatabase as any,
        mockServerService,
        mockLogger,
      )

      await expect(orchestrator.findOrCreateServer("10.0.0.1", 27015, "cstrike")).rejects.toThrow(
        "Failed to find or create server",
      )
    })

    it("should deduplicate concurrent creations for same server", async () => {
      const { ServerOrchestrator } = await import("./server-orchestrator.js")

      let resolveFind: (value: any) => void
      const delayedFind = new Promise((resolve) => {
        resolveFind = resolve
      })

      const mockDatabase = {
        prisma: {
          server: {
            findFirst: vi.fn().mockReturnValue(delayedFind),
          },
        },
        transaction: vi.fn(),
      }

      const orchestrator = new ServerOrchestrator(
        mockDatabase as any,
        mockServerService,
        mockLogger,
      )

      // Start two concurrent requests for the same server
      const p1 = orchestrator.findOrCreateServer("10.0.0.1", 27015, "cstrike")
      const p2 = orchestrator.findOrCreateServer("10.0.0.1", 27015, "cstrike")

      // Resolve the find
      resolveFind!({ serverId: 42, city: "", country: "", lat: null, lng: null })

      const [r1, r2] = await Promise.all([p1, p2])
      expect(r1.serverId).toBe(42)
      expect(r2.serverId).toBe(42)
      // findFirst should only be called once due to deduplication
      expect(mockDatabase.prisma.server.findFirst).toHaveBeenCalledTimes(1)
    })
  })
})
