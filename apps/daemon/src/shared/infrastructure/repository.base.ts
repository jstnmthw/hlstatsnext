/**
 * Base Repository Class
 *
 * Provides common database operations and patterns for all module repositories.
 */

import type { DatabaseClient } from "@/database/client"
import type { ILogger } from "@/shared/utils/logger"
import type { DatabaseTransaction, RepositoryOptions } from "@/shared/types/database"

export abstract class BaseRepository<T extends Record<string, unknown>> {
  protected abstract tableName: string

  constructor(
    protected readonly db: DatabaseClient,
    protected readonly logger: ILogger,
  ) {}

  protected get table() {
    return (this.db.prisma as any)[this.tableName]
  }

  protected async executeWithTransaction<R>(
    operation: (tx: DatabaseTransaction) => Promise<R>,
    options?: RepositoryOptions,
  ): Promise<R> {
    if (options?.transaction) {
      return operation(options.transaction)
    }

    return this.db.transaction(operation)
  }

  protected handleError(operation: string, error: unknown): never {
    const message = error instanceof Error ? error.message : String(error)
    this.logger.error(`${this.tableName} ${operation} failed: ${message}`)
    throw error
  }

  protected validateId(id: number, operation: string): void {
    if (!id || id <= 0) {
      throw new Error(`Invalid ${this.tableName} ID for ${operation}: ${id}`)
    }
  }

  protected cleanUpdateData(data: Partial<T>): Partial<T> {
    // Remove undefined values and system fields
    const cleaned = { ...data } as Record<string, unknown>
    delete cleaned.id
    delete cleaned.createdAt
    delete cleaned.updatedAt

    // Remove undefined values
    Object.keys(cleaned).forEach((key) => {
      if (cleaned[key] === undefined) {
        delete cleaned[key]
      }
    })

    return cleaned as Partial<T>
  }
}
