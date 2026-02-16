import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DatabaseClient, databaseClient, type TransactionalPrisma } from "./client"

// Mock @repo/database/client so `db` is a plain object (no real DB needed).
// Note: vitest may resolve this to a different module instance than the SUT,
// so we access the mock through client.prisma rather than importing it here.
vi.mock("@repo/database/client", () => ({
  db: {
    $queryRaw: vi.fn().mockResolvedValue([{ test: 1 }]),
    $transaction: vi.fn(),
    $disconnect: vi.fn(),
  } as Record<string, unknown>,
}))

describe("DatabaseClient", () => {
  let client: DatabaseClient

  beforeEach(() => {
    client = new DatabaseClient()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("prisma getter", () => {
    it("should return the db singleton by default", () => {
      expect(client.prisma).toBeDefined()
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
    it("should return true when query succeeds", async () => {
      const result = await client.testConnection()
      expect(result).toBe(true)
    })
  })

  describe("transaction", () => {
    it("should execute transaction with callback", async () => {
      // Access the actual db object that DatabaseClient uses via its public getter
      const dbObj = client.prisma as unknown as Record<string, ReturnType<typeof vi.fn>>
      const mockTx = {} as TransactionalPrisma
      const mockCallback = vi.fn().mockResolvedValue("result")

      dbObj.$transaction = vi
        .fn()
        .mockImplementation(async (callback: (tx: TransactionalPrisma) => Promise<unknown>) =>
          callback(mockTx),
        )

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
      const dbObj = client.prisma as unknown as Record<string, ReturnType<typeof vi.fn>>
      const mockError = new Error("Transaction callback error")
      const mockCallback = vi.fn().mockRejectedValue(mockError)

      dbObj.$transaction = vi
        .fn()
        .mockImplementation(async (callback: (tx: TransactionalPrisma) => Promise<unknown>) =>
          callback({} as TransactionalPrisma),
        )

      await expect(client.transaction(mockCallback)).rejects.toThrow(mockError)
    })
  })

  describe("disconnect", () => {
    it("should call db.$disconnect", async () => {
      // Access db through the public getter — same object the method uses
      const dbObj = client.prisma as unknown as Record<string, ReturnType<typeof vi.fn>>
      dbObj.$disconnect = vi.fn().mockResolvedValue(undefined)

      await client.disconnect()

      expect(dbObj.$disconnect).toHaveBeenCalled()
    })
  })
})

describe("exported databaseClient", () => {
  it("should export a default instance", () => {
    expect(databaseClient).toBeInstanceOf(DatabaseClient)
  })
})
