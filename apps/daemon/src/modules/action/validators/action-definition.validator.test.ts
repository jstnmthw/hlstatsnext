/**
 * Action Definition Validator Tests
 *
 * Tests for action definition validation.
 */

import { createMockLogger } from "@/tests/mocks/logger"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { IActionRepository } from "../action.types"
import { ActionDefinitionValidator } from "./action-definition.validator"

function createMockRepository(): IActionRepository {
  return {
    findActionByCode: vi.fn(),
    createPlayerAction: vi.fn(),
    createTeamAction: vi.fn(),
    getActionStats: vi.fn(),
    getPlayerActions: vi.fn(),
    updatePlayerActionStats: vi.fn(),
  } as unknown as IActionRepository
}

const mockActionDef = {
  id: 1,
  game: "cstrike",
  code: "Kill",
  rewardPlayer: 10,
  rewardTeam: 0,
  team: "",
  description: "Player kill",
  forPlayerActions: true,
  forPlayerPlayerActions: true,
  forTeamActions: false,
  forWorldActions: false,
}

describe("ActionDefinitionValidator", () => {
  let validator: ActionDefinitionValidator
  let mockRepository: IActionRepository
  let mockLogger: ReturnType<typeof createMockLogger>

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockRepository = createMockRepository()
    validator = new ActionDefinitionValidator(mockRepository, mockLogger)
  })

  describe("validatePlayerAction", () => {
    it("should return action when valid for player actions", async () => {
      vi.mocked(mockRepository.findActionByCode).mockResolvedValue({
        ...mockActionDef,
        forPlayerActions: true,
      })

      const result = await validator.validatePlayerAction("cstrike", "Kill", "CT")

      expect(result.shouldEarlyReturn).toBe(false)
      expect(result.actionDef).toBeDefined()
      expect(result.actionDef?.code).toBe("Kill")
    })

    it("should early return when action not found", async () => {
      vi.mocked(mockRepository.findActionByCode).mockResolvedValue(null)

      const result = await validator.validatePlayerAction("cstrike", "Unknown")

      expect(result.shouldEarlyReturn).toBe(true)
      expect(result.actionDef).toBeNull()
      expect(result.earlyResult).toEqual({ success: true })
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Unknown action code"))
    })

    it("should early return when action not valid for player actions", async () => {
      vi.mocked(mockRepository.findActionByCode).mockResolvedValue({
        ...mockActionDef,
        forPlayerActions: false,
      })

      const result = await validator.validatePlayerAction("cstrike", "TeamEvent")

      expect(result.shouldEarlyReturn).toBe(true)
      expect(result.actionDef).toBeDefined()
      expect(result.earlyResult).toEqual({ success: true })
    })
  })

  describe("validatePlayerPlayerAction", () => {
    it("should return action when valid for player-player actions", async () => {
      vi.mocked(mockRepository.findActionByCode).mockResolvedValue({
        ...mockActionDef,
        forPlayerPlayerActions: true,
      })

      const result = await validator.validatePlayerPlayerAction("cstrike", "Kill")

      expect(result.shouldEarlyReturn).toBe(false)
      expect(result.actionDef).toBeDefined()
    })

    it("should early return when action not found", async () => {
      vi.mocked(mockRepository.findActionByCode).mockResolvedValue(null)

      const result = await validator.validatePlayerPlayerAction("cstrike", "Unknown")

      expect(result.shouldEarlyReturn).toBe(true)
      expect(result.actionDef).toBeNull()
    })

    it("should early return when action not valid for player-player actions", async () => {
      vi.mocked(mockRepository.findActionByCode).mockResolvedValue({
        ...mockActionDef,
        forPlayerPlayerActions: false,
      })

      const result = await validator.validatePlayerPlayerAction("cstrike", "Solo")

      expect(result.shouldEarlyReturn).toBe(true)
      expect(result.actionDef).toBeDefined()
    })
  })

  describe("validateTeamAction", () => {
    it("should return action when valid for team actions", async () => {
      vi.mocked(mockRepository.findActionByCode).mockResolvedValue({
        ...mockActionDef,
        forTeamActions: true,
      })

      const result = await validator.validateTeamAction("cstrike", "BombPlant", "CT")

      expect(result.shouldEarlyReturn).toBe(false)
      expect(result.actionDef).toBeDefined()
    })

    it("should early return when action not found", async () => {
      vi.mocked(mockRepository.findActionByCode).mockResolvedValue(null)

      const result = await validator.validateTeamAction("cstrike", "Unknown")

      expect(result.shouldEarlyReturn).toBe(true)
      expect(result.actionDef).toBeNull()
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it("should early return when action not valid for team actions", async () => {
      vi.mocked(mockRepository.findActionByCode).mockResolvedValue({
        ...mockActionDef,
        forTeamActions: false,
      })

      const result = await validator.validateTeamAction("cstrike", "PlayerOnly")

      expect(result.shouldEarlyReturn).toBe(true)
      expect(result.actionDef).toBeDefined()
    })
  })

  describe("validateWorldAction", () => {
    it("should return action when valid for world actions", async () => {
      vi.mocked(mockRepository.findActionByCode).mockResolvedValue({
        ...mockActionDef,
        forWorldActions: true,
      })

      const result = await validator.validateWorldAction("cstrike", "RoundEnd")

      expect(result.shouldEarlyReturn).toBe(false)
      expect(result.actionDef).toBeDefined()
    })

    it("should early return when action not found", async () => {
      vi.mocked(mockRepository.findActionByCode).mockResolvedValue(null)

      const result = await validator.validateWorldAction("cstrike", "Unknown")

      expect(result.shouldEarlyReturn).toBe(true)
      expect(result.actionDef).toBeNull()
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it("should early return when action not valid for world actions", async () => {
      vi.mocked(mockRepository.findActionByCode).mockResolvedValue({
        ...mockActionDef,
        forWorldActions: false,
      })

      const result = await validator.validateWorldAction("cstrike", "PlayerOnly")

      expect(result.shouldEarlyReturn).toBe(true)
      expect(result.actionDef).toBeDefined()
    })
  })
})
