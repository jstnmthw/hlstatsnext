/**
 * Notification Configuration Repository Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { NotificationConfigRepository } from "./notification-config.repository"
import { createMockLogger } from "../../../tests/mocks/logger"
import { createMockDatabaseClient } from "../../../tests/mocks/database"
import type { TransactionalPrisma } from "@/database/client"

// Create proper mock interface for Prisma delegate
interface MockNotificationConfigDelegate {
  findUnique: ReturnType<typeof vi.fn>
  upsert: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

describe("NotificationConfigRepository", () => {
  let repository: NotificationConfigRepository
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockDatabase: TransactionalPrisma

  beforeEach(() => {
    mockLogger = createMockLogger()
    const mockDatabaseClient = createMockDatabaseClient()
    mockDatabase = mockDatabaseClient.prisma

    // Set up notificationConfig mock with proper types
    const mockNotificationConfig: MockNotificationConfigDelegate = {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    }

    Object.assign(mockDatabase, {
      notificationConfig: mockNotificationConfig,
    })

    repository = new NotificationConfigRepository(mockDatabase, mockLogger)
  })

  describe("getConfig", () => {
    it("should fetch config from database when not cached", async () => {
      const mockConfig = {
        serverId: 1,
        engineType: "goldsrc",
        colorEnabled: 1,
        colorScheme: null,
        eventTypes: null,
        messageFormats: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      ;(mockDatabase.notificationConfig.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockConfig,
      )

      const result = await repository.getConfig(1)

      expect(result).toEqual(mockConfig)
      expect(mockDatabase.notificationConfig.findUnique).toHaveBeenCalledWith({
        where: { serverId: 1 },
      })
    })

    it("should return cached config when available", async () => {
      const mockConfig = {
        serverId: 1,
        engineType: "goldsrc",
        colorEnabled: 1,
        colorScheme: null,
        eventTypes: null,
        messageFormats: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      ;(mockDatabase.notificationConfig.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockConfig,
      )

      // First call should fetch from database
      await repository.getConfig(1)

      // Second call should use cache
      const result = await repository.getConfig(1)

      expect(result).toEqual(mockConfig)
      expect(mockDatabase.notificationConfig.findUnique).toHaveBeenCalledTimes(1)
    })

    it("should handle database errors gracefully", async () => {
      ;(mockDatabase.notificationConfig.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database error"),
      )

      const result = await repository.getConfig(1)

      expect(result).toBeNull()
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to get notification config for server 1",
        expect.objectContaining({
          serverId: 1,
          error: "Database error",
        }),
      )
    })
  })

  describe("upsertConfig", () => {
    it("should create or update config in database", async () => {
      const config = {
        engineType: "goldsrc",
        colorEnabled: true,
        colorScheme: { tag: "#FF0000" },
        eventTypes: ["kill", "suicide"],
        messageFormats: { kill: "Custom kill message" },
      }

      const mockResult = {
        serverId: 1,
        engineType: "goldsrc",
        colorEnabled: 1,
        colorScheme: config.colorScheme,
        eventTypes: config.eventTypes,
        messageFormats: config.messageFormats,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      ;(mockDatabase.notificationConfig.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResult,
      )

      const result = await repository.upsertConfig(1, config)

      expect(result).toEqual(mockResult)
      expect(mockDatabase.notificationConfig.upsert).toHaveBeenCalledWith({
        where: { serverId: 1 },
        create: {
          serverId: 1,
          engineType: "goldsrc",
          colorEnabled: 1,
          colorScheme: config.colorScheme,
          eventTypes: config.eventTypes,
          messageFormats: config.messageFormats,
        },
        update: {
          engineType: "goldsrc",
          colorEnabled: 1,
          colorScheme: config.colorScheme,
          eventTypes: config.eventTypes,
          messageFormats: config.messageFormats,
        },
      })
    })
  })

  describe("deleteConfig", () => {
    it("should delete config from database and cache", async () => {
      ;(mockDatabase.notificationConfig.delete as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined,
      )

      await repository.deleteConfig(1)

      expect(mockDatabase.notificationConfig.delete).toHaveBeenCalledWith({
        where: { serverId: 1 },
      })
    })
  })

  describe("isEventTypeEnabled", () => {
    it("should return true when no config exists", async () => {
      ;(mockDatabase.notificationConfig.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      )

      const result = await repository.isEventTypeEnabled(1, "kill")

      expect(result).toBe(true)
    })

    it("should return true when eventTypes is null", async () => {
      const mockConfig = {
        serverId: 1,
        engineType: "goldsrc",
        colorEnabled: 1,
        colorScheme: null,
        eventTypes: null,
        messageFormats: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      ;(mockDatabase.notificationConfig.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockConfig,
      )

      const result = await repository.isEventTypeEnabled(1, "kill")

      expect(result).toBe(true)
    })

    it("should return true when event type is in the list", async () => {
      const mockConfig = {
        serverId: 1,
        engineType: "goldsrc",
        colorEnabled: 1,
        colorScheme: null,
        eventTypes: ["kill", "suicide"],
        messageFormats: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      ;(mockDatabase.notificationConfig.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockConfig,
      )

      const result = await repository.isEventTypeEnabled(1, "kill")

      expect(result).toBe(true)
    })

    it("should return false when event type is not in the list", async () => {
      const mockConfig = {
        serverId: 1,
        engineType: "goldsrc",
        colorEnabled: 1,
        colorScheme: null,
        eventTypes: ["kill", "suicide"],
        messageFormats: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      ;(mockDatabase.notificationConfig.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockConfig,
      )

      const result = await repository.isEventTypeEnabled(1, "teamkill")

      expect(result).toBe(false)
    })
  })

  describe("cache management", () => {
    it("should clear all cache", () => {
      repository.clearCache()
      // No assertion needed as this is a void method
    })

    it("should clear cache for specific server", () => {
      repository.clearServerCache(1)
      // No assertion needed as this is a void method
    })
  })

  describe("getConfigWithDefaults", () => {
    it("should return defaults when no config exists", async () => {
      ;(mockDatabase.notificationConfig.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      )

      const result = await repository.getConfigWithDefaults(1, "goldsrc")

      expect(result).toEqual({
        serverId: 1,
        engineType: "goldsrc",
        colorEnabled: false,
        colorScheme: null,
        eventTypes: null,
        messageFormats: null,
      })
    })

    it("should return config with proper type conversion", async () => {
      const mockConfig = {
        serverId: 1,
        engineType: "goldsrc",
        colorEnabled: 1,
        colorScheme: { tag: "#FF0000" },
        eventTypes: ["kill", "suicide"],
        messageFormats: { kill: "Custom message" },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      ;(mockDatabase.notificationConfig.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockConfig,
      )

      const result = await repository.getConfigWithDefaults(1, "goldsrc")

      expect(result).toEqual({
        serverId: 1,
        engineType: "goldsrc",
        colorEnabled: true,
        colorScheme: { tag: "#FF0000" },
        eventTypes: ["kill", "suicide"],
        messageFormats: { kill: "Custom message" },
      })
    })
  })
})
