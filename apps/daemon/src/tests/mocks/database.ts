/**
 * Database Mocks
 *
 * Mock implementations for database operations in tests.
 */

import type { TransactionalPrisma, DatabaseClient } from "@/database/client"
import { mockDeep } from "vitest-mock-extended"
import { vi, type MockedFunction } from "vitest"

// Type definitions for transaction callbacks
export type TransactionCallback<T = unknown> = (tx: TransactionalPrisma) => Promise<T>

// Dedicated mock type that extends DatabaseClient with proper mock capabilities
export interface MockDatabaseClient {
  readonly prisma: TransactionalPrisma
  transaction: MockedFunction<DatabaseClient["transaction"]>
  testConnection(): Promise<boolean>
  disconnect(): Promise<void>
  // Expose the mock for easy access in tests
  readonly mockPrisma: ReturnType<typeof mockDeep<TransactionalPrisma>>
}

// Factory function that creates a properly typed mock database client
export function createMockDatabaseClient(): MockDatabaseClient & DatabaseClient {
  const mockPrisma = mockDeep<TransactionalPrisma>()

  const mockTransaction = vi.fn().mockImplementation(async (callback: TransactionCallback) => {
    return callback(mockPrisma)
  }) as MockedFunction<DatabaseClient["transaction"]>

  // Create the mock client with proper typing
  const mockClient = {
    get prisma() {
      return mockPrisma
    },
    transaction: mockTransaction,
    async testConnection() {
      return true
    },
    async disconnect() {
      // Mock implementation - no-op
    },
    mockPrisma, // Direct access for tests
  } as MockDatabaseClient

  // Add the private client property to match DatabaseClient structure
  Object.defineProperty(mockClient, "client", {
    value: mockPrisma,
    writable: false,
    enumerable: false,
    configurable: false,
  })

  return mockClient as MockDatabaseClient & DatabaseClient
}
