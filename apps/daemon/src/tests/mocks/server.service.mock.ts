/**
 * Mock Server Service
 *
 * Provides mock implementations for server service interfaces
 */

import type { IServerService } from "@/modules/server/server.types"
import { vi } from "vitest"

export function createMockServerService(): IServerService {
  return {
    findById: vi.fn().mockResolvedValue(null),
    getServer: vi.fn().mockResolvedValue(null),
    getServerByAddress: vi.fn().mockResolvedValue(null),
    getServerGame: vi.fn().mockResolvedValue("cstrike"),
    getServerConfigBoolean: vi.fn().mockResolvedValue(false),
    getServerModType: vi.fn().mockResolvedValue(null),
    getServerConfig: vi.fn().mockResolvedValue(null),
    hasRconCredentials: vi.fn().mockResolvedValue(false),
    findActiveServersWithRcon: vi.fn().mockResolvedValue([]),
  }
}
