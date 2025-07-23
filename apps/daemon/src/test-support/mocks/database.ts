/**
 * Database Mocks
 *
 * Mock implementations for database operations in tests.
 */

import type { DatabaseClient } from "@/database/client"
import type { TransactionalPrisma } from "@/database/client"
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended"
import { vi, type MockedFunction } from "vitest"

export class MockDatabaseClient {
  private mockPrisma: DeepMockProxy<TransactionalPrisma>
  public transaction: MockedFunction<DatabaseClient["transaction"]>

  constructor() {
    this.mockPrisma = mockDeep<TransactionalPrisma>()

    // Create a proper Vitest mock for the transaction method with correct typing
    this.transaction = vi
      .fn()
      .mockImplementation(
        async <T>(callback: (tx: TransactionalPrisma) => Promise<T>): Promise<T> => {
          return callback(this.mockPrisma)
        },
      ) as MockedFunction<DatabaseClient["transaction"]>
  }

  get prisma(): DeepMockProxy<TransactionalPrisma> {
    return this.mockPrisma
  }

  async testConnection(): Promise<boolean> {
    return true
  }

  async disconnect(): Promise<void> {
    // Mock implementation - no-op
  }
}

export function createMockDatabaseClient(): MockDatabaseClient {
  return new MockDatabaseClient()
}
