/**
 * BatchedRepository Tests
 *
 * Tests for the BatchedRepository base class functionality
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import type { DatabaseClient } from "@/database/client"
import {
  BatchedRepository,
  type BatchUpdateOperation,
  type BatchCreateOperation,
} from "./batch-repository"
import { createMockLogger } from "@/tests/mocks/logger"

// Test entity type
interface TestEntity extends Record<string, unknown> {
  id: number
  name: string
  value: number
  updatedAt: Date
}

// Test operation types for testing
interface TestOperation {
  id: number
  data: Record<string, unknown>
}

interface TypedOperation {
  type: string
  data: string
}

interface PriorityOperation {
  priority: number
  data: string
}

interface ActionOperation {
  type: string
  playerId?: number
  teamId?: string
  mapId?: string
}

// Type for accessing protected methods in tests
type TestRepositoryWithProtectedMethods = TestBatchedRepository & {
  chunkOperations<T>(operations: T[], chunkSize?: number): T[][]
  executeBatchedOperation<Op, Result>(
    operations: Op[],
    executor: (chunk: Op[]) => Promise<Result>,
    chunkSize?: number,
  ): Promise<Result[]>
  groupOperationsByKey<Op, K extends string | number>(
    operations: Op[],
    keyExtractor: (op: Op) => K,
  ): Map<K, Op[]>
  validateIdsExist(
    ids: number[],
    entityName: string,
  ): Promise<{ valid: number[]; missing: number[] }>
}

// Concrete implementation for testing
class TestBatchedRepository extends BatchedRepository<TestEntity> {
  protected tableName = "test_entity"

  async findManyById(ids: number[]): Promise<Map<number, TestEntity>> {
    // Simulate database query
    const entities = ids.map((id) => ({
      id,
      name: `Entity ${id}`,
      value: id * 10,
      updatedAt: new Date(),
    }))

    const result = new Map<number, TestEntity>()
    entities.forEach((entity) => result.set(entity.id, entity))
    return result
  }

  async createMany(operations: BatchCreateOperation<TestEntity>[]): Promise<void> {
    // Simulate batch creation
    this.logger.debug(`Created ${operations.length} entities in batch`)
  }

  async updateMany(operations: BatchUpdateOperation<TestEntity>[]): Promise<void> {
    // Simulate batch updates
    this.logger.debug(`Updated ${operations.length} entities in batch`)
  }
}

describe("BatchedRepository", () => {
  let mockDatabase: DatabaseClient
  let mockLogger: ReturnType<typeof createMockLogger>
  let repository: TestBatchedRepository

  beforeEach(() => {
    mockDatabase = {} as DatabaseClient
    mockLogger = createMockLogger()

    repository = new TestBatchedRepository(mockDatabase, mockLogger)
  })

  describe("abstract method implementation", () => {
    it("should implement findManyById", async () => {
      const result = await repository.findManyById([1, 2, 3])

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(3)
      expect(result.get(1)).toEqual({
        id: 1,
        name: "Entity 1",
        value: 10,
        updatedAt: expect.any(Date),
      })
    })

    it("should implement createMany", async () => {
      const operations: BatchCreateOperation<TestEntity>[] = [
        { data: { id: 1, name: "Test 1", value: 100, updatedAt: new Date() } },
        { data: { id: 2, name: "Test 2", value: 200, updatedAt: new Date() } },
      ]

      await expect(repository.createMany(operations)).resolves.toBeUndefined()
      expect(mockLogger.debug).toHaveBeenCalledWith("Created 2 entities in batch")
    })

    it("should implement updateMany", async () => {
      const operations: BatchUpdateOperation<TestEntity>[] = [
        { id: 1, data: { name: "Updated 1" } },
        { id: 2, data: { value: 999 } },
      ]

      await expect(repository.updateMany(operations)).resolves.toBeUndefined()
      expect(mockLogger.debug).toHaveBeenCalledWith("Updated 2 entities in batch")
    })
  })

  describe("chunkOperations", () => {
    it("should chunk operations into smaller arrays", () => {
      const operations = Array.from({ length: 250 }, (_, i) => ({ id: i, data: {} }))

      // Use protected method via casting for testing
      const chunks = (repository as TestRepositoryWithProtectedMethods).chunkOperations(
        operations,
        100,
      )

      expect(chunks).toHaveLength(3)
      expect(chunks[0]!).toHaveLength(100)
      expect(chunks[1]!).toHaveLength(100)
      expect(chunks[2]!).toHaveLength(50)
    })

    it("should handle operations smaller than chunk size", () => {
      const operations = [
        { id: 1, data: {} },
        { id: 2, data: {} },
      ]

      const chunks = (repository as TestRepositoryWithProtectedMethods).chunkOperations(
        operations,
        100,
      )

      expect(chunks).toHaveLength(1)
      expect(chunks[0]!).toHaveLength(2)
    })

    it("should handle empty operations array", () => {
      const operations: TestOperation[] = []

      const chunks = (repository as TestRepositoryWithProtectedMethods).chunkOperations(
        operations,
        100,
      )

      expect(chunks).toHaveLength(0)
    })

    it("should use default chunk size of 100", () => {
      const operations = Array.from({ length: 150 }, (_, i) => ({ id: i }))

      const chunks = (repository as TestRepositoryWithProtectedMethods).chunkOperations(operations)

      expect(chunks).toHaveLength(2)
      expect(chunks[0]!).toHaveLength(100)
      expect(chunks[1]!).toHaveLength(50)
    })
  })

  describe("executeBatchedOperation", () => {
    it("should execute operations in chunks", async () => {
      const operations = Array.from({ length: 250 }, (_, i) => i)
      const mockExecutor = vi.fn().mockResolvedValue(`processed`)

      const results = await (
        repository as TestRepositoryWithProtectedMethods
      ).executeBatchedOperation(operations, mockExecutor, 100)

      expect(mockExecutor).toHaveBeenCalledTimes(3)
      expect(results).toHaveLength(3)
      expect(results).toEqual(["processed", "processed", "processed"])

      // Verify chunk sizes
      expect(mockExecutor.mock.calls[0]![0]).toHaveLength(100)
      expect(mockExecutor.mock.calls[1]![0]).toHaveLength(100)
      expect(mockExecutor.mock.calls[2]![0]).toHaveLength(50)
    })

    it("should handle executor errors", async () => {
      const operations = [1, 2, 3]
      const mockExecutor = vi.fn().mockRejectedValue(new Error("Execution failed"))

      await expect(
        (repository as TestRepositoryWithProtectedMethods).executeBatchedOperation(
          operations,
          mockExecutor,
          100,
        ),
      ).rejects.toThrow("Execution failed")

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Batch operation failed for chunk of size 3: Execution failed",
      )
    })

    it("should handle empty operations", async () => {
      const operations: TestOperation[] = []
      const mockExecutor = vi.fn()

      const results = await (
        repository as TestRepositoryWithProtectedMethods
      ).executeBatchedOperation(operations, mockExecutor, 100)

      expect(mockExecutor).not.toHaveBeenCalled()
      expect(results).toHaveLength(0)
    })
  })

  describe("groupOperationsByKey", () => {
    it("should group operations by key", () => {
      const operations: TypedOperation[] = [
        { type: "create", data: "a" },
        { type: "update", data: "b" },
        { type: "create", data: "c" },
        { type: "delete", data: "d" },
        { type: "update", data: "e" },
      ]

      const groups = (repository as TestRepositoryWithProtectedMethods).groupOperationsByKey(
        operations,
        (op: TypedOperation) => op.type,
      )

      expect(groups).toBeInstanceOf(Map)
      expect(groups.size).toBe(3)
      expect(groups.get("create")).toHaveLength(2)
      expect(groups.get("update")).toHaveLength(2)
      expect(groups.get("delete")).toHaveLength(1)
    })

    it("should handle empty operations", () => {
      const operations: TypedOperation[] = []

      const groups = (repository as TestRepositoryWithProtectedMethods).groupOperationsByKey(
        operations,
        (op: TypedOperation) => op.type,
      )

      expect(groups).toBeInstanceOf(Map)
      expect(groups.size).toBe(0)
    })

    it("should work with numeric keys", () => {
      const operations: PriorityOperation[] = [
        { priority: 1, data: "high" },
        { priority: 2, data: "medium" },
        { priority: 1, data: "high2" },
      ]

      const groups = (repository as TestRepositoryWithProtectedMethods).groupOperationsByKey(
        operations,
        (op: PriorityOperation) => op.priority,
      )

      expect(groups.get(1)).toHaveLength(2)
      expect(groups.get(2)).toHaveLength(1)
    })
  })

  describe("validateIdsExist", () => {
    it("should validate existing IDs", async () => {
      const result = await (repository as TestRepositoryWithProtectedMethods).validateIdsExist(
        [1, 2, 3],
        "TestEntity",
      )

      expect(result.valid).toEqual([1, 2, 3])
      expect(result.missing).toEqual([])
      expect(mockLogger.warn).not.toHaveBeenCalled()
    })

    it("should identify missing IDs", async () => {
      // Mock findManyById to return only some entities
      vi.spyOn(repository, "findManyById").mockResolvedValue(
        new Map([
          [1, { id: 1, name: "Entity 1", value: 10, updatedAt: new Date() }],
          [3, { id: 3, name: "Entity 3", value: 30, updatedAt: new Date() }],
        ]),
      )

      const result = await (repository as TestRepositoryWithProtectedMethods).validateIdsExist(
        [1, 2, 3, 4],
        "TestEntity",
      )

      expect(result.valid).toEqual([1, 3])
      expect(result.missing).toEqual([2, 4])
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "TestEntity IDs not found: 2, 4 (found: 2, missing: 2)",
      )
    })

    it("should handle empty ID list", async () => {
      const result = await (repository as TestRepositoryWithProtectedMethods).validateIdsExist(
        [],
        "TestEntity",
      )

      expect(result.valid).toEqual([])
      expect(result.missing).toEqual([])
    })

    it("should handle all missing IDs", async () => {
      vi.spyOn(repository, "findManyById").mockResolvedValue(new Map())

      const result = await (repository as TestRepositoryWithProtectedMethods).validateIdsExist(
        [1, 2, 3],
        "TestEntity",
      )

      expect(result.valid).toEqual([])
      expect(result.missing).toEqual([1, 2, 3])
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "TestEntity IDs not found: 1, 2, 3 (found: 0, missing: 3)",
      )
    })
  })

  describe("integration scenarios", () => {
    it("should handle large batch operations efficiently", async () => {
      const largeOperations = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        data: { name: `Entity ${i + 1}` },
      }))

      const mockExecutor = vi.fn().mockResolvedValue("success")

      await (repository as TestRepositoryWithProtectedMethods).executeBatchedOperation(
        largeOperations,
        mockExecutor,
        100,
      )

      // Should be chunked into 10 batches of 100 each
      expect(mockExecutor).toHaveBeenCalledTimes(10)
    })

    it("should maintain operation order within chunks", async () => {
      const operations = [1, 2, 3, 4, 5]
      const results: number[][] = []

      const mockExecutor = vi.fn().mockImplementation((chunk: number[]) => {
        results.push([...chunk])
        return Promise.resolve("success")
      })

      await (repository as TestRepositoryWithProtectedMethods).executeBatchedOperation(
        operations,
        mockExecutor,
        3,
      )

      expect(results).toEqual([
        [1, 2, 3],
        [4, 5],
      ])
    })

    it("should handle mixed operation types", () => {
      const operations: ActionOperation[] = [
        { type: "player_action", playerId: 1 },
        { type: "team_action", teamId: "CT" },
        { type: "player_action", playerId: 2 },
        { type: "world_action", mapId: "de_dust2" },
      ]

      const groups = (repository as TestRepositoryWithProtectedMethods).groupOperationsByKey(
        operations,
        (op: ActionOperation) => op.type,
      )

      expect(groups.get("player_action")).toHaveLength(2)
      expect(groups.get("team_action")).toHaveLength(1)
      expect(groups.get("world_action")).toHaveLength(1)
    })
  })

  describe("error handling", () => {
    it("should propagate errors from abstract methods", async () => {
      const errorRepo = new TestBatchedRepository(mockDatabase, mockLogger)

      // Override method to throw error
      vi.spyOn(errorRepo, "findManyById").mockRejectedValue(new Error("Database error"))

      await expect(errorRepo.findManyById([1, 2, 3])).rejects.toThrow("Database error")
    })

    it("should handle partial batch failures gracefully", async () => {
      const operations = [1, 2, 3, 4, 5, 6]
      let callCount = 0

      const mockExecutor = vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 2) {
          throw new Error("Second batch failed")
        }
        return Promise.resolve("success")
      })

      await expect(
        (repository as TestRepositoryWithProtectedMethods).executeBatchedOperation(
          operations,
          mockExecutor,
          3,
        ),
      ).rejects.toThrow("Second batch failed")

      // Should have attempted first batch successfully, then failed on second
      expect(mockExecutor).toHaveBeenCalledTimes(2)
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Batch operation failed for chunk of size 3: Second batch failed",
      )
    })
  })
})
