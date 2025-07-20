/**
 * Base Repository Class
 *
 * Provides common database operations and patterns for all module repositories.
 */

import type { DatabaseClient, TransactionalPrisma } from "@/database/client"
import type { ILogger } from "@/shared/utils/logger"
import type { RepositoryOptions } from "@/shared/types/database"
import type { Prisma } from "@repo/database/client"

export abstract class BaseRepository<T extends Record<string, unknown>> {
  protected abstract tableName: string

  constructor(
    protected readonly db: DatabaseClient,
    protected readonly logger: ILogger,
  ) {}

  protected get table() {
    return this.db.prisma[this.tableName as keyof TransactionalPrisma]
  }

  protected getClient(options?: RepositoryOptions): TransactionalPrisma {
    return options?.transaction || this.db.prisma
  }

  protected getTable(client: TransactionalPrisma) {
    return client[this.tableName as keyof TransactionalPrisma]
  }

  protected async executeWithTransaction<R>(
    operation: (client: TransactionalPrisma) => Promise<R>,
    options?: RepositoryOptions,
  ): Promise<R> {
    const client = this.getClient(options)

    if (options?.transaction) {
      return operation(client)
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
