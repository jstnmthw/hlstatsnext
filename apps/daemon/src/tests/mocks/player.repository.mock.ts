/**
 * Mock Player Repository for Testing
 */

import { vi } from "vitest"
import type { IPlayerRepository } from "@/modules/player/types/player.types"
import type { Player } from "@repo/database/client"

export function createMockPlayerRepository(): IPlayerRepository {
  const mockPlayer = {
    playerId: 1,
    clanId: null,
    lastName: "TestPlayer",
    fullName: null,
    email: null,
    lastEvent: new Date(),
    createdAt: new Date(),
    country: "US",
    city: "TestCity",
    state: null,
    flag: null,
    lat: null,
    lng: null,
    lastAddress: "127.0.0.1",
    game: "CS",
    skill: 1000,
    kills: 0,
    deaths: 0,
    suicides: 0,
    teamkills: 0,
    shots: 0,
    hits: 0,
    headshots: 0,
    killStreak: 0,
    deathStreak: 0,
    gamesPlayed: 0,
    hide: 0,
    hideRanking: 0,
    hideTitle: 0,
    displayBy: 0,
    activity: 0,
    connectionTime: 0,
    lastSkillChange: new Date(),
    displayEvents: 0,
    blockAvatar: 0,
    mmrank: null,
  } as unknown as Player

  return {
    // CRUD operations
    findById: vi.fn().mockResolvedValue(mockPlayer),
    findByUniqueId: vi.fn().mockResolvedValue(mockPlayer),
    create: vi.fn().mockResolvedValue(mockPlayer),
    upsertPlayer: vi.fn().mockResolvedValue(mockPlayer),
    update: vi.fn().mockResolvedValue(mockPlayer),

    // Unique ID management
    createUniqueId: vi.fn().mockResolvedValue(undefined),
    findUniqueIdEntry: vi.fn().mockResolvedValue(null),

    // Event creation
    createChatEvent: vi.fn().mockResolvedValue(undefined),
    createChangeNameEvent: vi.fn().mockResolvedValue(undefined),
    createChangeTeamEvent: vi.fn().mockResolvedValue(undefined),
    createChangeRoleEvent: vi.fn().mockResolvedValue(undefined),
    createSuicideEvent: vi.fn().mockResolvedValue(undefined),
    createTeamkillEvent: vi.fn().mockResolvedValue(undefined),
    createEntryEvent: vi.fn().mockResolvedValue(undefined),
    createConnectEvent: vi.fn().mockResolvedValue(undefined),
    createDisconnectEvent: vi.fn().mockResolvedValue(undefined),

    // Player stats
    getPlayerStats: vi.fn().mockResolvedValue(mockPlayer),
    logEventFrag: vi.fn().mockResolvedValue(undefined),
    updateServerForPlayerEvent: vi.fn().mockResolvedValue(undefined),
    upsertPlayerName: vi.fn().mockResolvedValue(undefined),
    hasRecentConnect: vi.fn().mockResolvedValue(false),

    // Batch operations
    getPlayerStatsBatch: vi.fn().mockResolvedValue(new Map()),
    updatePlayerStatsBatch: vi.fn().mockResolvedValue(undefined),

    // Command-related methods
    getPlayerRank: vi.fn().mockResolvedValue(1),
    getTotalPlayerCount: vi.fn().mockResolvedValue(100),
    getPlayerSessionStats: vi.fn().mockResolvedValue({
      kills: 5,
      deaths: 2,
      sessionTime: 1800,
    }),
  }
}
