/**
 * Database Mocks
 *
 * Mock implementations for database operations in tests.
 */

import type { MockedFunction } from "vitest"
import { db } from "@repo/database/client"
import type { TransactionalPrisma } from "@/database/client"
import { vi } from "vitest"

export interface MockDatabaseClient {
  prisma: TransactionalPrisma & {
    $transaction: MockedFunction<typeof db.$transaction>
    $disconnect: MockedFunction<typeof db.$disconnect>
  }
  testConnection: MockedFunction<() => Promise<boolean>>
  disconnect: MockedFunction<() => Promise<void>>
  transaction: MockedFunction<
    (callback: (prisma: TransactionalPrisma) => Promise<void>) => Promise<void>
  >
}

export function createMockDatabaseClient(): MockDatabaseClient {
  const mockPrisma = {
    player: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    server: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    playerUniqueId: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    eventEntry: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    weapon: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    playerHistory: {
      create: vi.fn(),
    },
    mapCount: {
      upsert: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(), 
    $executeRaw: vi.fn(),
    $executeRawUnsafe: vi.fn(),
    $transaction: vi.fn((callback) => callback(mockPrisma)),
    $disconnect: vi.fn(),
  } as TransactionalPrisma & {
    $transaction: MockedFunction<typeof db.$transaction>
    $disconnect: MockedFunction<typeof db.$disconnect>
  }

  return {
    prisma: mockPrisma,
    testConnection: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn().mockResolvedValue(undefined),
    transaction: vi.fn((callback: (prisma: TransactionalPrisma) => Promise<void>) =>
      callback(mockPrisma),
    ),
  }
}
