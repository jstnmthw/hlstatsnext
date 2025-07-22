/**
 * Database Mocks
 *
 * Mock implementations for database operations in tests.
 */

import type { MockedFunction } from "vitest"
import type { TransactionalPrisma } from "@/database/client"
import { vi } from "vitest"

export interface MockDatabaseClient {
  prisma: TransactionalPrisma
  testConnection: MockedFunction<() => Promise<boolean>>
  disconnect: MockedFunction<() => Promise<void>>
  transaction: MockedFunction<
    (callback: (prisma: TransactionalPrisma) => Promise<void>) => Promise<void>
  >
}

// Utility to deeply mock any object
function deepMock<T extends object>(overrides?: Partial<T>): T {
  const proxy = new Proxy(
    {},
    {
      get: () => vi.fn(),
    },
  ) as unknown as T
  return { ...proxy, ...overrides } as T
}

export function createMockDatabaseClient(): MockDatabaseClient {
  const prisma = deepMock<TransactionalPrisma>()

  // Optionally override only the methods you care about:
  prisma.player.findUnique = vi.fn()
  prisma.player.update = vi.fn()
  prisma.player.create = vi.fn()
  prisma.player.findMany = vi.fn()

  prisma.playerUniqueId.findUnique = vi.fn()
  prisma.playerUniqueId.create = vi.fn()
  prisma.playerUniqueId.update = vi.fn()

  prisma.server.findUnique = vi.fn()
  prisma.server.update = vi.fn()

  prisma.weapon.findUnique = vi.fn()
  prisma.weapon.upsert = vi.fn()

  return {
    prisma,
    testConnection: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn().mockResolvedValue(undefined),
    transaction: vi.fn((cb: (prisma: TransactionalPrisma) => Promise<void>) => cb(prisma)),
  }
}
