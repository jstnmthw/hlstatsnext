/**
 * Seed Server Defaults Tests
 *
 * Tests for server configuration default seeding.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import { createMockLogger } from "@/tests/mocks/logger"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { seedServerDefaults } from "./seed-server-defaults"

function createMockTransaction() {
  return {
    serverConfigDefault: {
      findMany: vi.fn(),
    },
    serverConfig: {
      createMany: vi.fn(),
    },
  }
}

describe("seedServerDefaults", () => {
  let mockTx: ReturnType<typeof createMockTransaction>
  let mockLogger: ILogger

  beforeEach(() => {
    mockTx = createMockTransaction()
    mockLogger = createMockLogger()
  })

  it("should seed server config defaults when defaults exist", async () => {
    const defaults = [
      { parameter: "EnableStats", value: "1" },
      { parameter: "TrackKills", value: "1" },
      { parameter: "ShowRankings", value: "1" },
    ]
    mockTx.serverConfigDefault.findMany.mockResolvedValue(defaults)
    mockTx.serverConfig.createMany.mockResolvedValue({ count: 3 })

    await seedServerDefaults(mockTx as any, 1, "192.168.1.1", 27015, mockLogger)

    expect(mockTx.serverConfigDefault.findMany).toHaveBeenCalled()
    expect(mockTx.serverConfig.createMany).toHaveBeenCalledWith({
      data: [
        { serverId: 1, parameter: "EnableStats", value: "1" },
        { serverId: 1, parameter: "TrackKills", value: "1" },
        { serverId: 1, parameter: "ShowRankings", value: "1" },
      ],
      skipDuplicates: true,
    })
    expect(mockLogger.debug).toHaveBeenCalledWith("Seeded 3 server config defaults for server 1")
  })

  it("should not create configs when no defaults exist", async () => {
    mockTx.serverConfigDefault.findMany.mockResolvedValue([])

    await seedServerDefaults(mockTx as any, 1, "192.168.1.1", 27015, mockLogger)

    expect(mockTx.serverConfig.createMany).not.toHaveBeenCalled()
    expect(mockLogger.debug).not.toHaveBeenCalled()
  })

  it("should handle errors gracefully and log warning", async () => {
    mockTx.serverConfigDefault.findMany.mockRejectedValue(new Error("Database error"))

    await seedServerDefaults(mockTx as any, 1, "192.168.1.1", 27015, mockLogger)

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Failed to seed server config defaults for 192.168.1.1:27015"),
    )
  })

  it("should handle createMany error gracefully", async () => {
    const defaults = [{ parameter: "EnableStats", value: "1" }]
    mockTx.serverConfigDefault.findMany.mockResolvedValue(defaults)
    mockTx.serverConfig.createMany.mockRejectedValue(new Error("Create failed"))

    await seedServerDefaults(mockTx as any, 1, "192.168.1.1", 27015, mockLogger)

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Failed to seed server config defaults"),
    )
  })

  it("should use correct serverId in created configs", async () => {
    const defaults = [{ parameter: "Test", value: "value" }]
    mockTx.serverConfigDefault.findMany.mockResolvedValue(defaults)
    mockTx.serverConfig.createMany.mockResolvedValue({ count: 1 })

    await seedServerDefaults(mockTx as any, 42, "10.0.0.1", 27016, mockLogger)

    expect(mockTx.serverConfig.createMany).toHaveBeenCalledWith({
      data: [{ serverId: 42, parameter: "Test", value: "value" }],
      skipDuplicates: true,
    })
  })
})
