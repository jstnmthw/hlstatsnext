import { vi } from "vitest"
import type { IMatchService } from "@/modules/match/match.types"

export function createMockMatchService(): IMatchService {
  return {
    handleMatchEvent: vi.fn().mockResolvedValue({ success: true }),
    getMatchStats: vi.fn().mockReturnValue(undefined),
    resetMatchStats: vi.fn().mockReturnValue(undefined),
    setPlayerTeam: vi.fn().mockReturnValue(undefined),
    getPlayersByTeam: vi.fn().mockReturnValue([]),
    getServerGame: vi.fn().mockResolvedValue("cstrike"),
  }
}
