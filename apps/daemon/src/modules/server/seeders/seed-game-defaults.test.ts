/**
 * Seed Game Defaults Tests
 *
 * Tests for game-specific configuration default seeding.
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { seedGameDefaults } from "./seed-game-defaults"
import { createMockLogger } from "@/tests/mocks/logger"
import type { ILogger } from "@/shared/utils/logger.types"

function createMockTransaction() {
  return {
    gameDefault: {
      findMany: vi.fn(),
    },
    serverConfig: {
      createMany: vi.fn(),
    },
  }
}

describe("seedGameDefaults", () => {
  let mockTx: ReturnType<typeof createMockTransaction>
  let mockLogger: ILogger

  beforeEach(() => {
    mockTx = createMockTransaction()
    mockLogger = createMockLogger()
  })

  it("should seed game defaults when defaults exist for game code", async () => {
    const gameDefaults = [
      { parameter: "GameSetting1", value: "on" },
      { parameter: "GameSetting2", value: "50" },
      { parameter: "GameSetting3", value: "custom" },
    ]
    mockTx.gameDefault.findMany.mockResolvedValue(gameDefaults)
    mockTx.serverConfig.createMany.mockResolvedValue({ count: 3 })

    await seedGameDefaults(mockTx as any, 1, "csgo", "192.168.1.1", 27015, mockLogger)

    expect(mockTx.gameDefault.findMany).toHaveBeenCalledWith({
      where: { code: "csgo" },
      select: { parameter: true, value: true },
    })
    expect(mockTx.serverConfig.createMany).toHaveBeenCalledWith({
      data: [
        { serverId: 1, parameter: "GameSetting1", value: "on" },
        { serverId: 1, parameter: "GameSetting2", value: "50" },
        { serverId: 1, parameter: "GameSetting3", value: "custom" },
      ],
      skipDuplicates: true,
    })
    expect(mockLogger.debug).toHaveBeenCalledWith("Seeded 3 game defaults (csgo) for server 1")
  })

  it("should not create configs when no game defaults exist", async () => {
    mockTx.gameDefault.findMany.mockResolvedValue([])

    await seedGameDefaults(mockTx as any, 1, "unknown", "192.168.1.1", 27015, mockLogger)

    expect(mockTx.serverConfig.createMany).not.toHaveBeenCalled()
    expect(mockLogger.debug).not.toHaveBeenCalled()
  })

  it("should handle errors gracefully and log warning", async () => {
    mockTx.gameDefault.findMany.mockRejectedValue(new Error("Database error"))

    await seedGameDefaults(mockTx as any, 1, "tf2", "192.168.1.1", 27015, mockLogger)

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Failed to seed game defaults (tf2) for 192.168.1.1:27015"),
    )
  })

  it("should handle createMany error gracefully", async () => {
    const gameDefaults = [{ parameter: "Setting", value: "value" }]
    mockTx.gameDefault.findMany.mockResolvedValue(gameDefaults)
    mockTx.serverConfig.createMany.mockRejectedValue(new Error("Create failed"))

    await seedGameDefaults(mockTx as any, 1, "cstrike", "192.168.1.1", 27015, mockLogger)

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Failed to seed game defaults"),
    )
  })

  it("should use correct serverId and game code", async () => {
    const gameDefaults = [{ parameter: "Test", value: "data" }]
    mockTx.gameDefault.findMany.mockResolvedValue(gameDefaults)
    mockTx.serverConfig.createMany.mockResolvedValue({ count: 1 })

    await seedGameDefaults(mockTx as any, 55, "hl2dm", "10.0.0.1", 27016, mockLogger)

    expect(mockTx.gameDefault.findMany).toHaveBeenCalledWith({
      where: { code: "hl2dm" },
      select: { parameter: true, value: true },
    })
    expect(mockTx.serverConfig.createMany).toHaveBeenCalledWith({
      data: [{ serverId: 55, parameter: "Test", value: "data" }],
      skipDuplicates: true,
    })
    expect(mockLogger.debug).toHaveBeenCalledWith("Seeded 1 game defaults (hl2dm) for server 55")
  })
})
