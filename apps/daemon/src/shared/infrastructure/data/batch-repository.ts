/**
 * Batched Repository Base Class
 *
 * Provides batch operations to prevent N+1 queries and improve performance.
 * Extends the existing BaseRepository with batching capabilities.
 */

import type { DatabaseClient } from "@/database/client"
import { BaseRepository } from "@/shared/infrastructure/persistence/repository.base"
import type { CreateOptions, FindOptions, UpdateOptions } from "@/shared/types/database"
import type { ILogger } from "@/shared/utils/logger.types"

export interface BatchUpdateOperation<T> {
  id: number
  data: Partial<T>
}

export interface BatchCreateOperation<T> {
  data: T
}

export abstract class BatchedRepository<
  T extends Record<string, unknown>,
> extends BaseRepository<T> {
  constructor(database: DatabaseClient, logger: ILogger) {
    super(database, logger)
  }

  /**
   * Find multiple entities by their IDs in a single query
   * Returns a Map for O(1) lookup by ID
   */
  abstract findManyById(ids: number[], options?: FindOptions): Promise<Map<number, T>>

  /**
   * Create multiple entities in a single transaction
   * Uses Prisma's createMany for optimal performance
   */
  abstract createMany(operations: BatchCreateOperation<T>[], options?: CreateOptions): Promise<void>

  /**
   * Update multiple entities in a single transaction
   * Groups updates by field changes for optimal queries
   */
  abstract updateMany(operations: BatchUpdateOperation<T>[], options?: UpdateOptions): Promise<void>

  /**
   * Utility method to chunk large batch operations
   */
  protected chunkOperations<Op>(operations: Op[], chunkSize: number = 100): Op[][] {
    const chunks: Op[][] = []
    for (let i = 0; i < operations.length; i += chunkSize) {
      chunks.push(operations.slice(i, i + chunkSize))
    }
    return chunks
  }

  /**
   * Execute batch operations in chunks to avoid overwhelming the database
   */
  protected async executeBatchedOperation<Op, Result>(
    operations: Op[],
    executor: (chunk: Op[]) => Promise<Result>,
    chunkSize: number = 100,
  ): Promise<Result[]> {
    const chunks = this.chunkOperations(operations, chunkSize)
    const results: Result[] = []

    for (const chunk of chunks) {
      try {
        const result = await executor(chunk)
        results.push(result)
      } catch (error) {
        this.logger.error(
          `Batch operation failed for chunk of size ${chunk.length}: ${error instanceof Error ? error.message : String(error)}`,
        )
        throw error
      }
    }

    return results
  }

  /**
   * Utility to group batch operations by a key for optimization
   */
  protected groupOperationsByKey<Op, K extends string | number>(
    operations: Op[],
    keyExtractor: (op: Op) => K,
  ): Map<K, Op[]> {
    const groups = new Map<K, Op[]>()

    for (const op of operations) {
      const key = keyExtractor(op)
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(op)
    }

    return groups
  }

  /**
   * Validate that all required IDs exist before performing operations
   */
  protected async validateIdsExist(
    ids: number[],
    entityName: string,
  ): Promise<{ valid: number[]; missing: number[] }> {
    if (ids.length === 0) {
      return { valid: [], missing: [] }
    }

    const existing = await this.findManyById(ids)
    const existingIds = new Set(existing.keys())

    const valid: number[] = []
    const missing: number[] = []

    for (const id of ids) {
      if (existingIds.has(id)) {
        valid.push(id)
      } else {
        missing.push(id)
      }
    }

    if (missing.length > 0) {
      this.logger.warn(
        `${entityName} IDs not found: ${missing.join(", ")} (found: ${valid.length}, missing: ${missing.length})`,
      )
    }

    return { valid, missing }
  }
}
