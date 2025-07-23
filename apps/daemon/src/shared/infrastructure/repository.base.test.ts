/**
 * BaseRepository Unit Tests
 */

import type { Player } from "@repo/database/client"
import type { ILogger } from "@/shared/utils/logger.types"
import type { DatabaseClient, TransactionalPrisma } from "@/database/client"
import type { RepositoryOptions } from "@/shared/types/database"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { BaseRepository } from "./repository.base"
import { createMockLogger } from "../../test-support/mocks/logger"
import {
  createMockDatabaseClient,
  type TransactionCallback,
  type MockDatabaseClient,
} from "../../test-support/mocks/database"
import { mockDeep as deepMock } from "vitest-mock-extended"

// Concrete implementation for testing
interface TestRecord extends Record<string, unknown> {
  id: number
  name: string
  value: number
  createdAt?: Date
  updatedAt?: Date
}

class TestRepository extends BaseRepository<TestRecord> {
  protected tableName = "test"

  constructor(db: DatabaseClient, logger: ILogger) {
    super(db, logger)
  }

  public validateIdPublic(id: number, operation: string): void {
    return this.validateId(id, operation)
  }

  public handleErrorPublic(operation: string, error: unknown): never {
    return this.handleError(operation, error)
  }

  public cleanUpdateDataPublic(data: Partial<TestRecord>): Partial<TestRecord> {
    return this.cleanUpdateData(data)
  }

  public async executeWithTransactionPublic<R>(
    operation: (client: TransactionalPrisma) => Promise<R>,
    options?: RepositoryOptions,
  ): Promise<R> {
    return this.executeWithTransaction(operation, options)
  }

  public get tablePublic() {
    return this.table
  }

  public get dbPublic() {
    return this.db
  }

  public get loggerPublic() {
    return this.logger
  }

  public get tableNamePublic() {
    return this.tableName
  }
}

// Test helpers for edge case testing
const testInvalidId = (id: unknown, operation: string, repository: TestRepository) => {
  return () => repository.validateIdPublic(id as number, operation)
}

const createTestRecordWithInvalidValue = (value: unknown): Partial<TestRecord> => {
  return {
    name: "test",
    value: value as number,
  }
}

describe("BaseRepository", () => {
  let repository: TestRepository
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockDatabase: MockDatabaseClient & DatabaseClient

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockDatabase = createMockDatabaseClient()
    repository = new TestRepository(mockDatabase, mockLogger)
  })

  describe("Repository instantiation", () => {
    it("should create repository instance", () => {
      expect(repository).toBeDefined()
      expect(repository).toBeInstanceOf(BaseRepository)
      expect(repository).toBeInstanceOf(TestRepository)
    })

    it("should store database and logger", () => {
      expect(repository.dbPublic).toBe(mockDatabase)
      expect(repository.loggerPublic).toBe(mockLogger)
    })

    it("should have tableName set", () => {
      expect(repository.tableNamePublic).toBe("test")
    })
  })

  describe("table getter", () => {
    it("should return table from prisma client", () => {
      const table = repository.tablePublic

      expect(table).toBeDefined()
      // The table should be the mock's test property
      expect(table).toBe((mockDatabase.prisma as Record<string, unknown>).test)
    })

    it("should work with different table names", () => {
      class PlayerRepository extends BaseRepository<Player> {
        protected tableName = "player"

        public get tablePublic() {
          return this.table
        }
      }

      const playerRepo = new PlayerRepository(mockDatabase, mockLogger)
      expect(playerRepo.tablePublic).toBe(mockDatabase.prisma.player)
    })
  })

  describe("executeWithTransaction", () => {
    it("should use provided transaction when available", async () => {
      const mockTransaction = deepMock<TransactionalPrisma>()
      const operation = vi.fn().mockResolvedValue("result")
      const options = { transaction: mockTransaction }
      const result = await repository.executeWithTransactionPublic(operation, options)

      expect(result).toBe("result")
      expect(operation).toHaveBeenCalledWith(mockTransaction)
      expect(mockDatabase.transaction).not.toHaveBeenCalled()
    })

    it("should create new transaction when not provided", async () => {
      const operation = vi.fn().mockResolvedValue("result")
      mockDatabase.transaction.mockImplementation(async (op: TransactionCallback) => op(mockDatabase.prisma))

      const result = await repository.executeWithTransactionPublic(operation)

      expect(result).toBe("result")
      expect(mockDatabase.transaction).toHaveBeenCalledWith(operation)
    })

    it("should create new transaction when options undefined", async () => {
      const operation = vi.fn().mockResolvedValue("result")
      mockDatabase.transaction.mockImplementation(async (op: TransactionCallback) => op(mockDatabase.prisma))

      const result = await repository.executeWithTransactionPublic(operation, undefined)

      expect(result).toBe("result")
      expect(mockDatabase.transaction).toHaveBeenCalledWith(operation)
    })

    it("should propagate transaction errors", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Transaction failed"))
      const mockTransaction = deepMock<TransactionalPrisma>()

      const options = { transaction: mockTransaction }

      await expect(repository.executeWithTransactionPublic(operation, options)).rejects.toThrow(
        "Transaction failed",
      )
    })

    it("should propagate database transaction errors", async () => {
      const operation = vi.fn()
      const transactionError = new Error("Database transaction failed")
      mockDatabase.transaction.mockRejectedValue(transactionError)

      await expect(repository.executeWithTransactionPublic(operation)).rejects.toThrow(
        "Database transaction failed",
      )
    })
  })

  describe("handleError", () => {
    it("should log error and rethrow Error instances", () => {
      const error = new Error("Test error")

      expect(() => repository.handleErrorPublic("testOperation", error)).toThrow("Test error")
      expect(mockLogger.error).toHaveBeenCalledWith("test testOperation failed: Test error")
    })

    it("should log error and rethrow string errors", () => {
      const error = "String error"

      expect(() => repository.handleErrorPublic("testOperation", error)).toThrow("String error")
      expect(mockLogger.error).toHaveBeenCalledWith("test testOperation failed: String error")
    })

    it("should handle null/undefined errors", () => {
      expect(() => repository.handleErrorPublic("testOperation", null)).toThrow()
      expect(mockLogger.error).toHaveBeenCalledWith("test testOperation failed: null")

      expect(() => repository.handleErrorPublic("testOperation", undefined)).toThrow()
      expect(mockLogger.error).toHaveBeenCalledWith("test testOperation failed: undefined")
    })

    it("should handle complex object errors", () => {
      const error = { code: "ERR001", details: "Complex error object" }

      expect(() => repository.handleErrorPublic("testOperation", error)).toThrow()
      expect(mockLogger.error).toHaveBeenCalledWith("test testOperation failed: [object Object]")
    })

    it("should include operation name in log message", () => {
      const error = new Error("Test error")

      expect(() => repository.handleErrorPublic("createUser", error)).toThrow("Test error")
      expect(mockLogger.error).toHaveBeenCalledWith("test createUser failed: Test error")
    })
  })

  describe("validateId", () => {
    it("should pass for valid positive IDs", () => {
      expect(() => repository.validateIdPublic(1, "test")).not.toThrow()
      expect(() => repository.validateIdPublic(999999, "test")).not.toThrow()
      expect(() => repository.validateIdPublic(1000000000, "test")).not.toThrow()
    })

    it("should throw for zero ID", () => {
      expect(() => repository.validateIdPublic(0, "test")).toThrow("Invalid test ID for test: 0")
    })

    it("should throw for negative IDs", () => {
      expect(() => repository.validateIdPublic(-1, "test")).toThrow("Invalid test ID for test: -1")
      expect(() => repository.validateIdPublic(-999, "test")).toThrow(
        "Invalid test ID for test: -999",
      )
    })

    it("should throw for null/undefined IDs", () => {
      expect(testInvalidId(null, "test", repository)).toThrow("Invalid test ID for test: null")
      expect(testInvalidId(undefined, "test", repository)).toThrow(
        "Invalid test ID for test: undefined",
      )
    })

    it("should include operation name in error message", () => {
      expect(() => repository.validateIdPublic(0, "deleteUser")).toThrow(
        "Invalid test ID for deleteUser: 0",
      )
    })

    it("should handle floating point IDs", () => {
      expect(testInvalidId(1.5, "test", repository)).not.toThrow() // JavaScript will treat 1.5 as truthy and > 0

      expect(testInvalidId(0.5, "test", repository)).not.toThrow() // 0.5 is > 0

      expect(testInvalidId(0.0, "test", repository)).toThrow("Invalid test ID for test: 0")
    })
  })

  describe("cleanUpdateData", () => {
    it("should remove system fields", () => {
      const data: Partial<TestRecord> = {
        id: 1,
        name: "test",
        value: 42,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const cleaned = repository.cleanUpdateDataPublic(data)

      expect(cleaned).toEqual({
        name: "test",
        value: 42,
      })
      expect(cleaned.id).toBeUndefined()
      expect(cleaned.createdAt).toBeUndefined()
      expect(cleaned.updatedAt).toBeUndefined()
    })

    it("should remove undefined values", () => {
      const data: Partial<TestRecord> = {
        name: "test",
        value: undefined,
        id: 1,
      }

      const cleaned = repository.cleanUpdateDataPublic(data)

      expect(cleaned).toEqual({
        name: "test",
      })
      expect(cleaned.value).toBeUndefined()
      expect(cleaned.id).toBeUndefined()
    })

    it("should preserve null values", () => {
      const data = createTestRecordWithInvalidValue(null)
      data.name = "test"

      const cleaned = repository.cleanUpdateDataPublic(data)

      expect(cleaned).toEqual({
        name: "test",
        value: null,
      })
    })

    it("should preserve zero values", () => {
      const data: Partial<TestRecord> = {
        name: "test",
        value: 0,
      }

      const cleaned = repository.cleanUpdateDataPublic(data)

      expect(cleaned).toEqual({
        name: "test",
        value: 0,
      })
    })

    it("should preserve false values", () => {
      interface TestRecordWithBoolean extends TestRecord {
        isActive: boolean
      }

      const data: Partial<TestRecordWithBoolean> = {
        name: "test",
        isActive: false,
      }

      const cleaned = repository.cleanUpdateDataPublic(data)

      expect(cleaned).toEqual({
        name: "test",
        isActive: false,
      })
    })

    it("should preserve empty strings", () => {
      const data: Partial<TestRecord> = {
        name: "",
        value: 42,
      }

      const cleaned = repository.cleanUpdateDataPublic(data)

      expect(cleaned).toEqual({
        name: "",
        value: 42,
      })
    })

    it("should handle empty objects", () => {
      const data: Partial<TestRecord> = {}

      const cleaned = repository.cleanUpdateDataPublic(data)

      expect(cleaned).toEqual({})
    })

    it("should handle objects with only system fields", () => {
      const data: Partial<TestRecord> = {
        id: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const cleaned = repository.cleanUpdateDataPublic(data)

      expect(cleaned).toEqual({})
    })

    it("should handle objects with only undefined values", () => {
      const data: Partial<TestRecord> = {
        name: undefined,
        value: undefined,
      }

      const cleaned = repository.cleanUpdateDataPublic(data)

      expect(cleaned).toEqual({})
    })

    it("should not mutate original data object", () => {
      const originalData: Partial<TestRecord> = {
        id: 1,
        name: "test",
        value: 42,
        createdAt: new Date(),
      }
      const originalDataCopy = { ...originalData }

      repository.cleanUpdateDataPublic(originalData)

      expect(originalData).toEqual(originalDataCopy)
    })

    it("should handle complex nested objects", () => {
      interface ComplexTestRecord extends TestRecord {
        metadata: {
          tags: string[]
          settings: Record<string, unknown>
        }
      }

      const data: Partial<ComplexTestRecord> = {
        name: "test",
        metadata: {
          tags: ["tag1", "tag2"],
          settings: { option1: true, option2: undefined },
        },
        id: 1,
        updatedAt: new Date(),
      }

      const cleaned = repository.cleanUpdateDataPublic(data)

      expect(cleaned).toEqual({
        name: "test",
        metadata: {
          tags: ["tag1", "tag2"],
          settings: { option1: true, option2: undefined },
        },
      })
    })
  })

  describe("Integration scenarios", () => {
    it("should handle complete repository workflow", async () => {
      const operation = vi.fn().mockResolvedValue({ id: 1, name: "test" })
      mockDatabase.transaction.mockImplementation(async (op: TransactionCallback) => op(mockDatabase.prisma))

      // Test ID validation, transaction, and error handling together
      expect(() => repository.validateIdPublic(1, "findById")).not.toThrow()

      const result = await repository.executeWithTransactionPublic(operation)
      expect(result).toEqual({ id: 1, name: "test" })

      const cleanData = repository.cleanUpdateDataPublic({
        id: 1,
        name: "updated",
        value: undefined,
        createdAt: new Date(),
      })
      expect(cleanData).toEqual({ name: "updated" })
    })

    it("should handle error scenarios in workflow", async () => {
      // Test validation error
      expect(() => repository.validateIdPublic(0, "findById")).toThrow(
        "Invalid test ID for findById: 0",
      )

      // Test transaction error
      const operation = vi.fn().mockRejectedValue(new Error("DB Error"))
      mockDatabase.transaction.mockImplementation(async (op: TransactionCallback) => op(mockDatabase.prisma))

      await expect(repository.executeWithTransactionPublic(operation)).rejects.toThrow("DB Error")

      // Test error handling
      expect(() => repository.handleErrorPublic("testOp", new Error("Test error"))).toThrow(
        "Test error",
      )
      expect(mockLogger.error).toHaveBeenCalledWith("test testOp failed: Test error")
    })
  })

  describe("Edge cases and boundary conditions", () => {
    it("should handle very large IDs", () => {
      const largeId = Number.MAX_SAFE_INTEGER
      expect(() => repository.validateIdPublic(largeId, "test")).not.toThrow()
    })

    it("should handle ID at boundary values", () => {
      expect(() => repository.validateIdPublic(1, "test")).not.toThrow() // Minimum valid
      expect(() => repository.validateIdPublic(0, "test")).toThrow() // Boundary invalid
      expect(() => repository.validateIdPublic(-1, "test")).toThrow() // Below boundary
    })

    it("should handle transaction with complex return types", async () => {
      const complexResult = {
        data: [{ id: 1 }, { id: 2 }],
        count: 2,
        metadata: { total: 100 },
      }

      const operation = vi.fn().mockResolvedValue(complexResult)
      mockDatabase.transaction.mockImplementation(async (op: TransactionCallback) => op(mockDatabase.prisma))

      const result = await repository.executeWithTransactionPublic(operation)

      expect(result).toEqual(complexResult)
    })

    it("should handle cleaning data with arrays and complex types", () => {
      interface ComplexRecord extends TestRecord {
        tags: string[]
        settings: Record<string, unknown>
        timestamps: Date[]
      }

      const data: Partial<ComplexRecord> = {
        name: "test",
        tags: ["a", "b", "c"],
        settings: {
          enabled: true,
          config: { deep: { nested: "value" } },
        },
        timestamps: [new Date(), new Date()],
        id: 1,
        value: undefined,
      }

      const cleaned = repository.cleanUpdateDataPublic(data)

      expect(cleaned).toEqual({
        name: "test",
        tags: ["a", "b", "c"],
        settings: {
          enabled: true,
          config: { deep: { nested: "value" } },
        },
        timestamps: data.timestamps,
      })
    })
  })
})
