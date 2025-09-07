/**
 * Mock RCON Service
 *
 * Provides mock implementations for RCON service interfaces
 */

import type { IRconService } from "@/modules/rcon/rcon.types"
import { vi } from "vitest"

export function createMockRconService(): IRconService {
  return {
    isConnected: vi.fn().mockReturnValue(false),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    disconnectAll: vi.fn().mockResolvedValue(undefined),
    executeCommand: vi.fn().mockResolvedValue(""),
    getStatus: vi.fn().mockResolvedValue({
      map: "de_dust2",
      players: 0,
      maxPlayers: 32,
      uptime: 3600,
      fps: 100,
      timestamp: new Date(),
      playerList: [],
    }),
  }
}
