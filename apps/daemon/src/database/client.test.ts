import { DatabaseClient as SharedDatabaseClient } from "@repo/database/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DatabaseClient, databaseClient, type TransactionalPrisma } from "./client"

vi.mock("@repo/database/client", () => ({
  DatabaseClient: vi.fn().mockImplementation(() => ({
    prisma: {
      $queryRaw: vi.fn(),
      $transaction: vi.fn(),
      $disconnect: vi.fn(),
    },
    configureConnectionPool: vi.fn(),
    testConnection: vi.fn(),
    disconnect: vi.fn(),
  })),
  db: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    $disconnect: vi.fn(),
  } as Record<string, unknown>,
}))

describe("DatabaseClient", () => {
  let mockSharedClient: SharedDatabaseClient
  let client: DatabaseClient

  beforeEach(() => {
    mockSharedClient = {
      prisma: {
        $queryRaw: vi.fn(),
        $transaction: vi.fn(),
        $disconnect: vi.fn(),
      },
      configureConnectionPool: vi.fn(),
      testConnection: vi.fn(),
      disconnect: vi.fn(),
    } as unknown as SharedDatabaseClient

    client = new DatabaseClient(mockSharedClient)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("constructor", () => {
    it("should create instance with provided shared client", () => {
      const customSharedClient = {
        prisma: { test: true },
        configureConnectionPool: vi.fn(),
        testConnection: vi.fn(),
        disconnect: vi.fn(),
      } as unknown as SharedDatabaseClient
      const dbClient = new DatabaseClient(customSharedClient)

      expect(dbClient.prisma).toBe(customSharedClient.prisma)
    })

    it("should create instance with default client when none provided", () => {
      const dbClient = new DatabaseClient()

      // Should use the default client (which is mocked)
      expect(dbClient.prisma).toBeDefined()
    })
  })

  describe("prisma getter", () => {
    it("should return the underlying client from shared client", () => {
      expect(client.prisma).toBe(mockSharedClient.prisma)
    })

    it("should return extended client when set", () => {
      const mockExtendedClient = { extended: true } as unknown as Parameters<
        typeof client.setExtendedClient
      >[0]
      client.setExtendedClient(mockExtendedClient)

      expect(client.prisma).toBe(mockExtendedClient)
    })
  })

  describe("testConnection", () => {
    it("should delegate to shared client", async () => {
      vi.mocked(mockSharedClient.testConnection).mockResolvedValue(true)

      const result = await client.testConnection()

      expect(result).toBe(true)
      expect(mockSharedClient.testConnection).toHaveBeenCalled()
    })

    it("should return false when shared client test fails", async () => {
      vi.mocked(mockSharedClient.testConnection).mockResolvedValue(false)

      const result = await client.testConnection()

      expect(result).toBe(false)
    })
  })

  describe("transaction", () => {
    it("should execute transaction with callback", async () => {
      const mockTx = {} as TransactionalPrisma
      const mockCallback = vi.fn().mockResolvedValue("result")
      const prismaWithTransaction = mockSharedClient.prisma as unknown as {
        $transaction: ReturnType<typeof vi.fn>
      }
      vi.mocked(prismaWithTransaction.$transaction).mockImplementation(
        async (callback: (tx: TransactionalPrisma) => Promise<unknown>) => {
          return callback(mockTx)
        },
      )

      const result = await client.transaction(mockCallback)

      expect(result).toBe("result")
      expect(prismaWithTransaction.$transaction).toHaveBeenCalledWith(mockCallback)
      expect(mockCallback).toHaveBeenCalledWith(mockTx)
    })

    it("should use extended client for transaction when set", async () => {
      const mockTx = {} as TransactionalPrisma
      const mockCallback = vi.fn().mockResolvedValue("extended result")
      const mockExtendedClient = {
        $transaction: vi
          .fn()
          .mockImplementation(async (callback: (tx: TransactionalPrisma) => Promise<unknown>) =>
            callback(mockTx),
          ),
      } as unknown as Parameters<typeof client.setExtendedClient>[0]
      client.setExtendedClient(mockExtendedClient)

      const result = await client.transaction(mockCallback)

      expect(result).toBe("extended result")
      expect(
        (mockExtendedClient as unknown as { $transaction: ReturnType<typeof vi.fn> }).$transaction,
      ).toHaveBeenCalledWith(mockCallback)
    })

    it("should propagate transaction callback errors", async () => {
      const mockError = new Error("Transaction callback error")
      const mockCallback = vi.fn().mockRejectedValue(mockError)
      const prismaWithTransaction = mockSharedClient.prisma as unknown as {
        $transaction: ReturnType<typeof vi.fn>
      }
      vi.mocked(prismaWithTransaction.$transaction).mockImplementation(
        async (callback: (tx: TransactionalPrisma) => Promise<unknown>) => {
          return callback({} as TransactionalPrisma)
        },
      )

      await expect(client.transaction(mockCallback)).rejects.toThrow(mockError)
    })
  })

  describe("disconnect", () => {
    it("should delegate to shared client", async () => {
      vi.mocked(mockSharedClient.disconnect).mockResolvedValue()

      await client.disconnect()

      expect(mockSharedClient.disconnect).toHaveBeenCalled()
    })

    it("should handle disconnect errors", async () => {
      const mockError = new Error("Disconnect failed")
      vi.mocked(mockSharedClient.disconnect).mockRejectedValue(mockError)

      await expect(client.disconnect()).rejects.toThrow(mockError)
    })
  })

  describe("configureConnectionPool", () => {
    it("should delegate to shared client", () => {
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        ok: vi.fn(),
      } as Parameters<typeof client.configureConnectionPool>[0]
      const mockConfig = { maxConnections: 10 }

      client.configureConnectionPool(mockLogger, mockConfig)

      expect(mockSharedClient.configureConnectionPool).toHaveBeenCalledWith(mockLogger, mockConfig)
    })
  })
})

describe("exported databaseClient", () => {
  it("should export a default instance", () => {
    expect(databaseClient).toBeInstanceOf(DatabaseClient)
  })
})
