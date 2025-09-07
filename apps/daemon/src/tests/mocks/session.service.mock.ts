/**
 * Mock Session Service
 *
 * Provides mock implementations for player session service interfaces
 */

import type { IPlayerSessionService } from "@/modules/player/types/player-session.types"
import { vi } from "vitest"

export function createMockSessionService(): IPlayerSessionService {
  return {
    createSession: vi.fn().mockResolvedValue({
      serverId: 1,
      gameUserId: 2,
      databasePlayerId: 100,
      steamId: "STEAM_0:1:12345",
      playerName: "TestPlayer",
      isBot: false,
      connectedAt: new Date(),
      lastSeen: new Date(),
    }),
    updateSession: vi.fn().mockResolvedValue(null),
    removeSession: vi.fn().mockResolvedValue(true),
    clearServerSessions: vi.fn().mockResolvedValue(0),
    getSessionByGameUserId: vi.fn().mockResolvedValue(null),
    getSessionByPlayerId: vi.fn().mockResolvedValue(null),
    getSessionBySteamId: vi.fn().mockResolvedValue(null),
    getServerSessions: vi.fn().mockResolvedValue([]),
    synchronizeServerSessions: vi.fn().mockResolvedValue(0),
    convertToGameUserIds: vi.fn().mockResolvedValue([]),
    canSendPrivateMessage: vi.fn().mockResolvedValue(true),
    getSessionStats: vi.fn().mockResolvedValue({
      totalSessions: 0,
      serverSessions: {},
      botSessions: 0,
      realPlayerSessions: 0,
    }),
  }
}
