/**
 * Mock Player Service
 *
 * Provides mock implementations for player service and resolver interfaces
 */

import type { IPlayerService, IPlayerResolver } from "@/modules/player/player.types"
import { vi } from "vitest"

export function createMockPlayerResolver(): IPlayerResolver {
  return {
    getOrCreatePlayer: vi.fn().mockResolvedValue(100),
  }
}

export function createMockPlayerService(): IPlayerService {
  return {
    getOrCreatePlayer: vi.fn().mockResolvedValue(100),
    getPlayerStats: vi.fn().mockResolvedValue(null),
    updatePlayerStats: vi.fn().mockResolvedValue(undefined),
    getPlayerStatsBatch: vi.fn().mockResolvedValue(new Map()),
    updatePlayerStatsBatch: vi.fn().mockResolvedValue(undefined),
    getPlayerRating: vi.fn().mockResolvedValue({
      playerId: 1,
      rating: 1000,
      confidence: 0.5,
      volatility: 0.06,
      gamesPlayed: 10,
    }),
    updatePlayerRatings: vi.fn().mockResolvedValue(undefined),
    handlePlayerEvent: vi.fn().mockResolvedValue({ success: true }),
  }
}
