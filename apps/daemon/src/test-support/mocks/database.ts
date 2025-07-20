/**
 * Database Mocks
 *
 * Mock implementations for database operations in tests.
 */

import type { MockedFunction } from "vitest"
import { db } from "@repo/database/client"
import type { TransactionalPrisma } from "@/database/client"
import { prismaPartialMock } from "./prismaPartialMock"
import { vi } from "vitest"

export interface MockDatabaseClient {
  prisma: TransactionalPrisma
  testConnection: MockedFunction<() => Promise<boolean>>
  disconnect: MockedFunction<() => Promise<void>>
  transaction: MockedFunction<
    (callback: (prisma: TransactionalPrisma) => Promise<void>) => Promise<void>
  >
}

export function createMockDatabaseClient(): MockDatabaseClient {
  const prisma = prismaPartialMock({
    player: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), findMany: vi.fn() } as any,
    playerUniqueId: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() } as any,
    server: { findUnique: vi.fn(), update: vi.fn() } as any,
    weapon: { findUnique: vi.fn(), upsert: vi.fn() } as any,
    $transaction: vi.fn((cb) => cb(prisma)),
    $disconnect: vi.fn(),
  })

  return {
    prisma,
    testConnection: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn().mockResolvedValue(undefined),
    transaction: prisma.$transaction,
  }
}
