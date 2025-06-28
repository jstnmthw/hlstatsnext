/**
 * Test Mock Type Definitions
 *
 * Proper type definitions for test mocks to avoid using 'any' types
 * while maintaining test flexibility and type safety.
 */

import type { DatabaseClient } from "../../src/database/client"
import type { GameEvent } from "../../src/types/common/events"
import { vi } from "vitest"

/**
 * Mock Prisma client structure for testing
 */
export interface MockPrismaClient {
  player: {
    update: ReturnType<typeof vi.fn>
    upsert: ReturnType<typeof vi.fn>
  }
  eventFrag: {
    create: ReturnType<typeof vi.fn>
  }
  // Add other Prisma models as needed
  [key: string]: {
    [method: string]: ReturnType<typeof vi.fn>
  }
}

/**
 * Mock DatabaseClient for testing
 */
export interface MockDatabaseClient extends Omit<DatabaseClient, "prisma"> {
  getOrCreatePlayer: ReturnType<typeof vi.fn>
  createGameEvent: ReturnType<typeof vi.fn>
  testConnection: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  prisma: MockPrismaClient
}

/**
 * Partial mock database for error testing scenarios
 */
export interface PartialMockDatabaseClient {
  getOrCreatePlayer: ReturnType<typeof vi.fn>
  createGameEvent?: ReturnType<typeof vi.fn>
  testConnection?: ReturnType<typeof vi.fn>
  disconnect?: ReturnType<typeof vi.fn>
  prisma?: Partial<MockPrismaClient>
}

/**
 * Malformed event type for testing invalid data handling
 */
export interface MalformedEvent {
  eventType: string // Invalid event type
  serverId: number
  timestamp: Date
  meta?: {
    steamId: string
    playerName: string
    isBot: boolean
  }
  data: Record<string, unknown>
}

/**
 * Helper function to create a mock database client
 */
export function createMockDatabaseClient(overrides?: Partial<MockDatabaseClient>): MockDatabaseClient {
  return {
    getOrCreatePlayer: vi.fn().mockResolvedValue(1),
    createGameEvent: vi.fn().mockResolvedValue(undefined),
    testConnection: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn().mockResolvedValue(undefined),
    updatePlayerStats: vi.fn().mockResolvedValue(undefined),
    getPlayerStats: vi.fn().mockResolvedValue(null),
    transaction: vi.fn().mockImplementation((callback) => callback({})),
    getServerByAddress: vi.fn().mockResolvedValue(null),
    getTopPlayers: vi.fn().mockResolvedValue([]),
    prisma: {
      player: {
        update: vi.fn().mockResolvedValue({}),
        upsert: vi.fn().mockResolvedValue({}),
      },
      eventFrag: {
        create: vi.fn().mockResolvedValue({}),
      },
    },
    ...overrides,
  }
}

/**
 * Helper function to create a failing mock database client
 */
export function createFailingMockDatabaseClient(error: Error): PartialMockDatabaseClient {
  return {
    getOrCreatePlayer: vi.fn().mockRejectedValue(error),
  }
}

/**
 * Type guard to safely cast unknown values for testing
 */
export function asUnknownEvent(event: MalformedEvent): GameEvent {
  // This is only for testing malformed events - we know it's not really a GameEvent
  return event as unknown as GameEvent
}
