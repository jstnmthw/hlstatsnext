/**
 * Test Mock Type Definitions
 *
 * Proper type definitions for test mocks to avoid using 'any' types
 * while maintaining test flexibility and type safety.
 */

import { vi } from "vitest"
import { EventType, PlayerDeathEvent, type GameEvent } from "../../src/types/common/events"
import type { UdpServer } from "../../src/services/ingress/udp-server"
import type { CsParser } from "../../src/services/ingress/parsers/cs.parser"
import type { EventProcessorService } from "../../src/services/processor/processor.service"
import type { DatabaseClient } from "../../src/database/client"
import type { ServerService } from "../../src/services/server/server.service"
import type { PlayerService } from "../../src/services/player/player.service"
import type { EventService } from "../../src/services/event/event.service"
import type { WeaponService } from "../../src/services/weapon/weapon.service"
import type { ILogger } from "../../src/utils/logger.types"
import type { Player } from "@repo/database"

/**
 * Mock UdpServer for testing
 */
export interface MockUdpServer extends Omit<UdpServer, "start" | "stop" | "on"> {
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  emit: ReturnType<typeof vi.fn>
}

/**
 * Mock CsParser for testing
 */
export interface MockCsParser extends Omit<CsParser, "parse" | "canParse"> {
  parse: ReturnType<typeof vi.fn>
  canParse: ReturnType<typeof vi.fn>
}

/**
 * Mock EventProcessorService for testing
 */
export interface MockEventProcessorService extends Omit<EventProcessorService, "processEvent"> {
  processEvent: ReturnType<typeof vi.fn>
}

/**
 * Mock ServerService for testing
 */
export interface MockServerService extends Omit<ServerService, "getServerByAddress"> {
  getServerByAddress: ReturnType<typeof vi.fn>
  db: MockDatabaseClient
}

/**
 * Mock PlayerService for testing
 */
export interface MockPlayerService
  extends Omit<
    PlayerService,
    "getOrCreatePlayer" | "updatePlayerStats" | "getPlayerStats" | "getTopPlayers"
  > {
  getOrCreatePlayer: ReturnType<typeof vi.fn>
  updatePlayerStats: ReturnType<typeof vi.fn>
  getPlayerStats: ReturnType<typeof vi.fn>
  getTopPlayers: ReturnType<typeof vi.fn>
}

/**
 * Mock EventService for testing
 */
export interface MockEventService extends Omit<EventService, "createGameEvent"> {
  createGameEvent: ReturnType<typeof vi.fn>
}

/**
 * Mock WeaponService for testing
 */
export interface MockWeaponService extends Omit<WeaponService, "getWeaponModifier"> {
  getWeaponModifier: ReturnType<typeof vi.fn>
}

/**
 * Mock DatabaseClient for testing
 */
export interface MockDatabaseClient extends Omit<DatabaseClient, "prisma"> {
  prisma: {
    playerUniqueId: {
      findUnique: ReturnType<typeof vi.fn>
    }
    player: {
      create: ReturnType<typeof vi.fn>
      update: ReturnType<typeof vi.fn>
      findUnique: ReturnType<typeof vi.fn>
      findMany: ReturnType<typeof vi.fn>
    }
    server: {
      findFirst: ReturnType<typeof vi.fn>
      create: ReturnType<typeof vi.fn>
    }
    weapon: {
      findFirst: ReturnType<typeof vi.fn>
    }
    eventConnect: {
      create: ReturnType<typeof vi.fn>
    }
    eventDisconnect: {
      create: ReturnType<typeof vi.fn>
    }
    eventFrag: {
      create: ReturnType<typeof vi.fn>
    }
    eventSuicide: {
      create: ReturnType<typeof vi.fn>
    }
    eventTeamkill: {
      create: ReturnType<typeof vi.fn>
    }
    eventChat: {
      create: ReturnType<typeof vi.fn>
    }
    eventEntry: {
      findMany: ReturnType<typeof vi.fn>
    }
  }
  testConnection: ReturnType<typeof vi.fn>
  transaction: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  client: unknown // Private property needed for type compatibility
}

/**
 * Partial mock for DatabaseClient when only some methods are needed
 */
export interface PartialMockDatabaseClient {
  testConnection?: ReturnType<typeof vi.fn>
  transaction?: ReturnType<typeof vi.fn>
  disconnect?: ReturnType<typeof vi.fn>
  prisma?: Partial<MockDatabaseClient["prisma"]>
}

/**
 * Create a mock DatabaseClient with all methods stubbed
 */
export function createMockDatabaseClient(
  overrides?: Partial<MockDatabaseClient>,
): MockDatabaseClient {
  const mockPrisma = {
    playerUniqueId: {
      findUnique: vi.fn(),
    },
    player: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    server: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    weapon: {
      findFirst: vi.fn(),
    },
    eventConnect: {
      create: vi.fn(),
    },
    eventDisconnect: {
      create: vi.fn(),
    },
    eventFrag: {
      create: vi.fn(),
    },
    eventSuicide: {
      create: vi.fn(),
    },
    eventTeamkill: {
      create: vi.fn(),
    },
    eventChat: {
      create: vi.fn(),
    },
    eventEntry: {
      findMany: vi.fn(),
    },
  }

  return {
    prisma: { ...mockPrisma, ...overrides?.prisma },
    testConnection: vi.fn().mockResolvedValue(true),
    transaction: vi.fn().mockImplementation((callback) => callback(mockPrisma)),
    disconnect: vi.fn().mockResolvedValue(undefined),
    client: undefined,
    ...overrides,
  } as MockDatabaseClient
}

/**
 * Create a mock ServerService
 */
export function createMockServerService(overrides?: Partial<MockServerService>): MockServerService {
  return {
    getServerByAddress: vi.fn(),
    db: createMockDatabaseClient(),
    ...overrides,
  } as MockServerService
}

/**
 * Create a mock PlayerService
 */
export function createMockPlayerService(overrides?: Partial<MockPlayerService>): MockPlayerService {
  return {
    getOrCreatePlayer: vi.fn(),
    updatePlayerStats: vi.fn(),
    getPlayerStats: vi.fn(),
    getTopPlayers: vi.fn(),
    ...overrides,
  } as MockPlayerService
}

/**
 * Create a mock EventService
 */
export function createMockEventService(overrides?: Partial<MockEventService>): MockEventService {
  return {
    createGameEvent: vi.fn(),
    ...overrides,
  } as MockEventService
}

/**
 * Create a mock WeaponService
 */
export function createMockWeaponService(overrides?: Partial<MockWeaponService>): MockWeaponService {
  return {
    getWeaponModifier: vi.fn(),
    ...overrides,
  } as MockWeaponService
}

/**
 * Create a failing mock DatabaseClient that throws errors
 */
export function createFailingMockDatabaseClient(error: Error): PartialMockDatabaseClient {
  return {
    testConnection: vi.fn().mockRejectedValue(error),
    transaction: vi.fn().mockRejectedValue(error),
    disconnect: vi.fn().mockRejectedValue(error),
    prisma: {
      playerUniqueId: {
        findUnique: vi.fn().mockRejectedValue(error),
      },
      player: {
        create: vi.fn().mockRejectedValue(error),
        update: vi.fn().mockRejectedValue(error),
        findUnique: vi.fn().mockRejectedValue(error),
        findMany: vi.fn().mockRejectedValue(error),
      },
    },
  }
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
 * Type guard to safely cast unknown values for testing
 */
export function asUnknownEvent(event: MalformedEvent): GameEvent {
  // This is only for testing malformed events - we know it's not really a GameEvent
  return event as GameEvent
}

/**
 * Creates a mock logger for testing services that require ILogger.
 */
export function createMockLogger(): ILogger {
  return {
    ok: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    event: vi.fn(),
    chat: vi.fn(),
    starting: vi.fn(),
    started: vi.fn(),
    stopping: vi.fn(),
    stopped: vi.fn(),
    connecting: vi.fn(),
    connected: vi.fn(),
    disconnected: vi.fn(),
    failed: vi.fn(),
    ready: vi.fn(),
    received: vi.fn(),
    shutdown: vi.fn(),
    shutdownComplete: vi.fn(),
    fatal: vi.fn(),
    disableTimestamps: vi.fn(),
    enableTimestamps: vi.fn(),
    disableColors: vi.fn(),
    setColorsEnabled: vi.fn(),
  }
}

/**
 * Helper to build a mock Player object
 */
export const createMockPlayer = (overrides: Partial<Player> = {}): Player => ({
  playerId: 1,
  last_event: 0,
  connection_time: 0,
  last_skill_change: 0,
  lastName: "Player",
  lastAddress: "127.0.0.1",
  fullName: null,
  email: null,
  homepage: null,
  icq: null,
  city: "",
  state: "",
  country: "",
  flag: "",
  lat: null,
  lng: null,
  clan: 0,
  kills: 0,
  deaths: 0,
  suicides: 0,
  skill: 1000,
  shots: 0,
  hits: 0,
  teamkills: 0,
  headshots: 0,
  kill_streak: 0,
  death_streak: 0,
  activity: 100,
  game: "cstrike",
  hideranking: 0,
  displayEvents: 1,
  blockavatar: 0,
  mmrank: null,
  createdate: 0,
  ...overrides,
})

/**
 * Creates a mock GameEvent for testing event handlers.
 */
export const createMockGameEvent = (args: Partial<GameEvent> = {}): GameEvent => {
  const event: GameEvent = {
    eventType: EventType.PLAYER_DEATH,
    data: {
      killerId: 1,
      victimId: 2,
      weapon: "ak47",
      headshot: false,
      victimTeam: "T",
      killerTeam: "T",
    },
    ...args,
  } as PlayerDeathEvent

  return event
}
