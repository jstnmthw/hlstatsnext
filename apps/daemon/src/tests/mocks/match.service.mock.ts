import { vi } from "vitest"
import type { IMatchService } from "@/modules/match/match.types"

export function createMockMatchService(): IMatchService {
  return {
    handleMatchEvent: vi.fn().mockResolvedValue({ success: true }),
    handleKillInMatch: vi.fn().mockResolvedValue({ success: true }),
    handleObjectiveAction: vi.fn().mockResolvedValue({ success: true }),
    getMatchStats: vi.fn().mockReturnValue(undefined),
    getCurrentMap: vi.fn().mockReturnValue("de_dust2"),
    initializeMapForServer: vi.fn().mockResolvedValue("de_dust2"),
    resetMatchStats: vi.fn().mockReturnValue(undefined),
    updatePlayerWeaponStats: vi.fn().mockReturnValue(undefined),
    calculateMatchMVP: vi.fn().mockResolvedValue(undefined),
    calculatePlayerScore: vi.fn().mockReturnValue(0),
    setPlayerTeam: vi.fn().mockReturnValue(undefined),
    getPlayersByTeam: vi.fn().mockReturnValue([]),
    getServerGame: vi.fn().mockResolvedValue("cstrike"),
  }
}
