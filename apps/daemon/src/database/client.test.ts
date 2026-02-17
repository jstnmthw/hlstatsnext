/**
 * DatabaseClient Tests
 *
 * Tests the daemon's DatabaseClient wrapper. Since vi.mock("@repo/db/client")
 * doesn't work reliably with isolate: false (setup.ts preloads the module),
 * tests use setExtendedClient() to inject mock Prisma clients instead.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DatabaseClient, databaseClient, type TransactionalPrisma } from "./client"

describe("DatabaseClient", () => {
  let client: DatabaseClient

  beforeEach(() => {
    client = new DatabaseClient()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("prisma getter", () => {
    it("should return extended client when set", () => {
      const mockExtendedClient = { extended: true } as unknown as Parameters<
        typeof client.setExtendedClient
      >[0]
      client.setExtendedClient(mockExtendedClient)

      expect(client.prisma).toBe(mockExtendedClient)
    })
  })

  describe("testConnection", () => {
    it("should return true when query succeeds", async () => {
      const mockPrisma = { $queryRaw: vi.fn().mockResolvedValue([{ test: 1 }]) } as any
      client.setExtendedClient(mockPrisma)

      const result = await client.testConnection()
      expect(result).toBe(true)
    })

    it("should return false when query fails", async () => {
      const mockPrisma = {
        $queryRaw: vi.fn().mockRejectedValue(new Error("connection refused")),
      } as any
      client.setExtendedClient(mockPrisma)

      const result = await client.testConnection()
      expect(result).toBe(false)
    })
  })

  describe("transaction", () => {
    it("should execute transaction with callback", async () => {
      const mockTx = {} as TransactionalPrisma
      const mockCallback = vi.fn().mockResolvedValue("result")
      const mockPrisma = {
        $transaction: vi
          .fn()
          .mockImplementation(async (callback: (tx: TransactionalPrisma) => Promise<unknown>) =>
            callback(mockTx),
          ),
      } as any
      client.setExtendedClient(mockPrisma)

      const result = await client.transaction(mockCallback)

      expect(result).toBe("result")
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
      const mockPrisma = {
        $transaction: vi
          .fn()
          .mockImplementation(async (callback: (tx: TransactionalPrisma) => Promise<unknown>) =>
            callback({} as TransactionalPrisma),
          ),
      } as any
      client.setExtendedClient(mockPrisma)

      await expect(client.transaction(mockCallback)).rejects.toThrow(mockError)
    })
  })

  describe("disconnect", () => {
    it("should call db.$disconnect", async () => {
      const mockPrisma = { $disconnect: vi.fn().mockResolvedValue(undefined) } as any
      client.setExtendedClient(mockPrisma)

      await client.disconnect()

      expect(mockPrisma.$disconnect).toHaveBeenCalled()
    })
  })
})

describe("exported databaseClient", () => {
  it("should export a default instance", () => {
    expect(databaseClient).toBeInstanceOf(DatabaseClient)
  })
})
