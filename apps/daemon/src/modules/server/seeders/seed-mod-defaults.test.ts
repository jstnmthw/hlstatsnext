/**
 * Seed Mod Defaults Tests
 *
 * Tests for mod-specific configuration default seeding.
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { seedModDefaults } from "./seed-mod-defaults"
import { createMockLogger } from "@/tests/mocks/logger"
import type { ILogger } from "@/shared/utils/logger.types"

function createMockTransaction() {
  return {
    modDefault: {
      findMany: vi.fn(),
    },
    serverConfig: {
      createMany: vi.fn(),
    },
  }
}

describe("seedModDefaults", () => {
  let mockTx: ReturnType<typeof createMockTransaction>
  let mockLogger: ILogger

  beforeEach(() => {
    mockTx = createMockTransaction()
    mockLogger = createMockLogger()
  })

  it("should seed mod defaults when defaults exist for game code", async () => {
    const modDefaults = [
      { parameter: "ModSetting1", value: "enabled" },
      { parameter: "ModSetting2", value: "100" },
    ]
    mockTx.modDefault.findMany.mockResolvedValue(modDefaults)
    mockTx.serverConfig.createMany.mockResolvedValue({ count: 2 })

    await seedModDefaults(mockTx as any, 1, "tf", "192.168.1.1", 27015, mockLogger)

    expect(mockTx.modDefault.findMany).toHaveBeenCalledWith({
      where: { code: "tf" },
      select: { parameter: true, value: true },
    })
    expect(mockTx.serverConfig.createMany).toHaveBeenCalledWith({
      data: [
        { serverId: 1, parameter: "ModSetting1", value: "enabled" },
        { serverId: 1, parameter: "ModSetting2", value: "100" },
      ],
      skipDuplicates: true,
    })
    expect(mockLogger.debug).toHaveBeenCalledWith("Seeded 2 mod defaults (tf) for server 1")
  })

  it("should not create configs when no mod defaults exist", async () => {
    mockTx.modDefault.findMany.mockResolvedValue([])

    await seedModDefaults(mockTx as any, 1, "unknown", "192.168.1.1", 27015, mockLogger)

    expect(mockTx.serverConfig.createMany).not.toHaveBeenCalled()
    expect(mockLogger.debug).not.toHaveBeenCalled()
  })

  it("should handle errors gracefully and log warning", async () => {
    mockTx.modDefault.findMany.mockRejectedValue(new Error("Database error"))

    await seedModDefaults(mockTx as any, 1, "cstrike", "192.168.1.1", 27015, mockLogger)

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Failed to seed mod defaults (cstrike) for 192.168.1.1:27015"),
    )
  })

  it("should handle createMany error gracefully", async () => {
    const modDefaults = [{ parameter: "Setting", value: "value" }]
    mockTx.modDefault.findMany.mockResolvedValue(modDefaults)
    mockTx.serverConfig.createMany.mockRejectedValue(new Error("Create failed"))

    await seedModDefaults(mockTx as any, 1, "csgo", "192.168.1.1", 27015, mockLogger)

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Failed to seed mod defaults"),
    )
  })

  it("should use correct serverId and game code", async () => {
    const modDefaults = [{ parameter: "Test", value: "data" }]
    mockTx.modDefault.findMany.mockResolvedValue(modDefaults)
    mockTx.serverConfig.createMany.mockResolvedValue({ count: 1 })

    await seedModDefaults(mockTx as any, 99, "dod", "10.0.0.1", 27016, mockLogger)

    expect(mockTx.modDefault.findMany).toHaveBeenCalledWith({
      where: { code: "dod" },
      select: { parameter: true, value: true },
    })
    expect(mockTx.serverConfig.createMany).toHaveBeenCalledWith({
      data: [{ serverId: 99, parameter: "Test", value: "data" }],
      skipDuplicates: true,
    })
    expect(mockLogger.debug).toHaveBeenCalledWith("Seeded 1 mod defaults (dod) for server 99")
  })
})
