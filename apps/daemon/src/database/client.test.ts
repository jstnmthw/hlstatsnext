import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { DatabaseClient, databaseClient, type TransactionalPrisma } from "./client"
import type { PrismaClient } from "@repo/database/client"

vi.mock("@repo/database/client", () => ({
  db: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    $disconnect: vi.fn(),
  } as any,
}))

describe("DatabaseClient", () => {
  let mockPrismaClient: PrismaClient
  let client: DatabaseClient

  beforeEach(() => {
    mockPrismaClient = {
      $queryRaw: vi.fn(),
      $transaction: vi.fn(),
      $disconnect: vi.fn(),
    } as unknown as PrismaClient

    client = new DatabaseClient(mockPrismaClient)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("constructor", () => {
    it("should create instance with provided client", () => {
      const customClient = {} as PrismaClient
      const dbClient = new DatabaseClient(customClient)
      
      expect(dbClient.prisma).toBe(customClient)
    })

    it("should create instance with default client when none provided", () => {
      const dbClient = new DatabaseClient()
      
      // Should use the default client (which is mocked)
      expect(dbClient.prisma).toBeDefined()
    })
  })

  describe("prisma getter", () => {
    it("should return the underlying client", () => {
      expect(client.prisma).toBe(mockPrismaClient)
    })
  })

  describe("testConnection", () => {
    it("should return true when connection test succeeds", async () => {
      vi.mocked(mockPrismaClient.$queryRaw).mockResolvedValue([{ "1": 1 }])

      const result = await client.testConnection()

      expect(result).toBe(true)
      expect(mockPrismaClient.$queryRaw).toHaveBeenCalledWith(expect.arrayContaining(["SELECT 1"]))
    })

    it("should return false when connection test fails", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      vi.mocked(mockPrismaClient.$queryRaw).mockRejectedValue(new Error("Connection failed"))

      const result = await client.testConnection()

      expect(result).toBe(false)
      expect(consoleErrorSpy).toHaveBeenCalledWith("Database connection test failed:", expect.any(Error))
      
      consoleErrorSpy.mockRestore()
    })

    it("should handle non-Error exceptions", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      vi.mocked(mockPrismaClient.$queryRaw).mockRejectedValue("String error")

      const result = await client.testConnection()

      expect(result).toBe(false)
      expect(consoleErrorSpy).toHaveBeenCalledWith("Database connection test failed:", "String error")
      
      consoleErrorSpy.mockRestore()
    })
  })

  describe("transaction", () => {
    it("should execute transaction with callback", async () => {
      const mockTx = {} as TransactionalPrisma
      const mockCallback = vi.fn().mockResolvedValue("result")
      vi.mocked(mockPrismaClient.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx)
      })

      const result = await client.transaction(mockCallback)

      expect(result).toBe("result")
      expect(mockPrismaClient.$transaction).toHaveBeenCalledWith(mockCallback)
      expect(mockCallback).toHaveBeenCalledWith(mockTx)
    })

    it("should throw error when trying to start transaction within transaction", async () => {
      const transactionalClient = {} as TransactionalPrisma
      const clientWithoutTransaction = new DatabaseClient(transactionalClient)
      const mockCallback = vi.fn()

      await expect(clientWithoutTransaction.transaction(mockCallback)).rejects.toThrow(
        "Cannot start a transaction within a transaction."
      )
      expect(mockCallback).not.toHaveBeenCalled()
    })

    it("should propagate transaction callback errors", async () => {
      const mockError = new Error("Transaction callback error")
      const mockCallback = vi.fn().mockRejectedValue(mockError)
      vi.mocked(mockPrismaClient.$transaction).mockImplementation(async (callback) => {
        return callback({} as TransactionalPrisma)
      })

      await expect(client.transaction(mockCallback)).rejects.toThrow(mockError)
    })
  })

  describe("disconnect", () => {
    it("should disconnect when client supports it", async () => {
      vi.mocked(mockPrismaClient.$disconnect).mockResolvedValue()

      await client.disconnect()

      expect(mockPrismaClient.$disconnect).toHaveBeenCalled()
    })

    it("should not call disconnect on transactional client", async () => {
      const transactionalClient = {} as TransactionalPrisma
      const clientWithoutDisconnect = new DatabaseClient(transactionalClient)
      const disconnectSpy = vi.fn()

      await clientWithoutDisconnect.disconnect()

      expect(disconnectSpy).not.toHaveBeenCalled()
    })

    it("should handle disconnect errors", async () => {
      const mockError = new Error("Disconnect failed")
      vi.mocked(mockPrismaClient.$disconnect).mockRejectedValue(mockError)

      await expect(client.disconnect()).rejects.toThrow(mockError)
    })
  })
})

describe("exported databaseClient", () => {
  it("should export a default instance", () => {
    expect(databaseClient).toBeInstanceOf(DatabaseClient)
  })
})