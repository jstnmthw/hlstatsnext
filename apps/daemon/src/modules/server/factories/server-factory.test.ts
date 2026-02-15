/**
 * Server Factory Tests
 *
 * Tests for server creation with default configuration seeding.
 */

import type { DatabaseClient } from "@/database/client"
import type { ILogger } from "@/shared/utils/logger.types"
import { createMockLogger } from "@/tests/mocks/logger"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ServerFactory } from "./server-factory"

// Mock the seeder functions
vi.mock("../seeders/seed-server-defaults", () => ({
  seedServerDefaults: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../seeders/seed-game-defaults", () => ({
  seedGameDefaults: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../seeders/seed-mod-defaults", () => ({
  seedModDefaults: vi.fn().mockResolvedValue(undefined),
}))

function createMockDatabaseClient() {
  const mockTx = {
    server: {
      create: vi.fn(),
    },
  }

  return {
    transaction: vi.fn().mockImplementation(async (callback) => {
      return callback(mockTx)
    }),
    _mockTx: mockTx,
  }
}

describe("ServerFactory", () => {
  let factory: ServerFactory
  let mockLogger: ILogger
  let mockDatabase: ReturnType<typeof createMockDatabaseClient>

  beforeEach(() => {
    vi.clearAllMocks()
    mockLogger = createMockLogger()
    mockDatabase = createMockDatabaseClient()
    factory = new ServerFactory(mockDatabase as unknown as DatabaseClient, mockLogger)
  })

  describe("createNewServerWithDefaults", () => {
    it("should create server with seeded defaults in transaction", async () => {
      const mockServer = {
        serverId: 1,
        game: "cstrike",
        address: "192.168.1.100",
        port: 27015,
        publicAddress: "192.168.1.100:27015",
        name: "Server 192.168.1.100:27015",
      }

      mockDatabase._mockTx.server.create.mockResolvedValue(mockServer)

      const serverSelect = { serverId: true, game: true, address: true, port: true }

      const result = await factory.createNewServerWithDefaults(
        "192.168.1.100",
        27015,
        "cstrike",
        serverSelect,
      )

      expect(result).toEqual(mockServer)
      expect(mockDatabase.transaction).toHaveBeenCalled()
    })

    it("should use correct server data when creating", async () => {
      const mockServer = { serverId: 1 }
      mockDatabase._mockTx.server.create.mockResolvedValue(mockServer)

      await factory.createNewServerWithDefaults("1.2.3.4", 27020, "valve", { serverId: true })

      expect(mockDatabase._mockTx.server.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          game: "valve",
          address: "1.2.3.4",
          port: 27020,
          publicAddress: "1.2.3.4:27020",
          name: "Server 1.2.3.4:27020",
        }),
        select: { serverId: true },
      })
    })
  })
})
