/**
 * MatchService Unit Tests
 */

import { describe, it, expect, beforeEach } from "vitest"
import { MatchService } from "./match.service"
import { MatchRepository } from "./match.repository"
import { createMockLogger } from "../../test-support/mocks/logger"
import { createMockDatabaseClient } from "../../test-support/mocks/database"
import type { DatabaseClient } from "@/database/client"

describe("MatchService", () => {
  let matchService: MatchService
  let mockRepository: MatchRepository
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockDatabase: ReturnType<typeof createMockDatabaseClient>

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockDatabase = createMockDatabaseClient()
    mockRepository = new MatchRepository(mockDatabase as unknown as DatabaseClient, mockLogger)
    matchService = new MatchService(mockRepository, mockLogger)
  })

  describe("Service methods", () => {
    it("should have handleMatchEvent method", () => {
      expect(matchService.handleMatchEvent).toBeDefined()
      expect(typeof matchService.handleMatchEvent).toBe("function")
    })

    it("should have handleObjectiveEvent method", () => {
      expect(matchService.handleObjectiveEvent).toBeDefined()
      expect(typeof matchService.handleObjectiveEvent).toBe("function")
    })

    it("should have getMatchStats method", () => {
      expect(matchService.getMatchStats).toBeDefined()
      expect(typeof matchService.getMatchStats).toBe("function")
    })

    it("should have resetMatchStats method", () => {
      expect(matchService.resetMatchStats).toBeDefined()
      expect(typeof matchService.resetMatchStats).toBe("function")
    })
  })

  describe("Service instantiation", () => {
    it("should create service instance", () => {
      expect(matchService).toBeDefined()
      expect(matchService).toBeInstanceOf(MatchService)
    })
  })
})
