import { vi } from "vitest"
import type { IServerRepository } from "@/modules/server/server.types"

export function createMockServerRepository(): IServerRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByAddress: vi.fn().mockResolvedValue(null),
    getServerConfig: vi.fn().mockResolvedValue(null),
    hasRconCredentials: vi.fn().mockResolvedValue(false),
    findActiveServersWithRcon: vi.fn().mockResolvedValue([]),
    findServersByIds: vi.fn().mockResolvedValue([]),
    findAllServersWithRcon: vi.fn().mockResolvedValue([]),
    updateServerStatusFromRcon: vi.fn().mockResolvedValue(undefined),
    resetMapStats: vi.fn().mockResolvedValue(undefined),
    getModDefault: vi.fn().mockResolvedValue(null),
    getServerConfigDefault: vi.fn().mockResolvedValue(null),
  }
}
