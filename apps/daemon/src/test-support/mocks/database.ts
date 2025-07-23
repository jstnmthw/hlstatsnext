/**
 * Database Mocks
 *
 * Mock implementations for database operations in tests.
 */

import { DatabaseClient } from "@/database/client"
import type { TransactionalPrisma } from "@/database/client"
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended"

export class MockDatabaseClient extends DatabaseClient {
  private mockPrisma: DeepMockProxy<TransactionalPrisma>

  constructor() {
    const mockPrisma = mockDeep<TransactionalPrisma>()
    super(mockPrisma)
    this.mockPrisma = mockPrisma
  }

  get prisma(): DeepMockProxy<TransactionalPrisma> {
    return this.mockPrisma
  }
}

export function createMockDatabaseClient(): MockDatabaseClient {
  return new MockDatabaseClient()
}
