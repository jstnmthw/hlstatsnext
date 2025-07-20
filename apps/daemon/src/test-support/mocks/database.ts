/**
 * Database Mocks
 *
 * Mock implementations for database operations in tests.
 */

import type { MockedFunction } from "vitest"
import { db } from "@repo/database/client"
import { vi } from "vitest"

export interface MockDatabaseClient {
  prisma: {
    player: {
      findUnique: MockedFunction<typeof db.player.findUnique>
      findMany: MockedFunction<typeof db.player.findMany>
      create: MockedFunction<typeof db.player.create>
      update: MockedFunction<typeof db.player.update>
      delete: MockedFunction<typeof db.player.delete>
    }
    // playerStats: {
    //   findUnique: MockedFunction<typeof db.playerStats.findUnique>
    //   create: MockedFunction<typeof db.playerStats.create>
    //   update: MockedFunction<typeof db.playerStats.update>
    // }
    server: {
      findFirst: MockedFunction<typeof db.server.findFirst>
      findUnique: MockedFunction<typeof db.server.findUnique>
      create: MockedFunction<typeof db.server.create>
      update: MockedFunction<typeof db.server.update>
    }
    // gameEvent: {
    //   create: MockedFunction<typeof db.gameEvent.create>
    //   findMany: MockedFunction<typeof db.gameEvent.findMany>
    // }
    playerUniqueId: {
      findUnique: MockedFunction<typeof db.playerUniqueId.findUnique>
      create: MockedFunction<typeof db.playerUniqueId.create>
    }
    eventEntry: {
      findMany: MockedFunction<typeof db.eventEntry.findMany>
      create: MockedFunction<typeof db.eventEntry.create>
    }
    weapon: {
      findUnique: MockedFunction<typeof db.weapon.findUnique>
      upsert: MockedFunction<typeof db.weapon.upsert>
    }
    $transaction: MockedFunction<typeof db.$transaction>
    $disconnect: MockedFunction<typeof db.$disconnect>
  }
  testConnection: MockedFunction<() => Promise<boolean>>
  disconnect: MockedFunction<() => Promise<void>>
  transaction: MockedFunction<
    (callback: (prisma: MockDatabaseClient["prisma"]) => Promise<void>) => Promise<void>
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
    // playerStats: {
    //   findUnique: vi.fn(),
    //   create: vi.fn(),
    //   update: vi.fn(),
    // },
    server: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    // gameEvent: {
    //   create: vi.fn(),
    //   findMany: vi.fn(),
    // },
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
    $transaction: vi.fn((callback) => callback(mockPrisma)),
    $disconnect: vi.fn(),
  }

  return {
    prisma: mockPrisma,
    testConnection: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn().mockResolvedValue(undefined),
    transaction: vi.fn((callback: (prisma: typeof mockPrisma) => Promise<void>) =>
      callback(mockPrisma),
    ),
  }
}
