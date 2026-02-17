/**
 * Action Repository Integration Tests
 *
 * Tests action lookups and event logging against a real MySQL database.
 */

import { DatabaseClient } from "@/database/client"
import { ActionRepository } from "@/modules/action/action.repository"
import type { ILogger } from "@/shared/utils/logger.types"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { getTestDb } from "../helpers/test-db"

describe("ActionRepository (integration)", () => {
  let repo: ActionRepository
  let db: DatabaseClient
  let serverId: number
  let playerId: number

  const silentLogger: ILogger = {
    ok: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    event: vi.fn(),
    queue: vi.fn(),
    database: vi.fn(),
    rcon: vi.fn(),
    network: vi.fn(),
    fatal: vi.fn(),
    getLogLevel: vi.fn().mockReturnValue("silent"),
    setLogLevel: vi.fn(),
    formatDuration: vi.fn(),
    child: vi.fn().mockReturnThis(),
  } as unknown as ILogger

  beforeEach(async () => {
    const testPrisma = getTestDb()
    db = new DatabaseClient()
    Object.defineProperty(db, "prisma", { get: () => testPrisma, configurable: true })
    db.transaction = (cb) => testPrisma.$transaction(cb)

    repo = new ActionRepository(db, silentLogger)

    const server = await testPrisma.server.create({
      data: { name: "Action Test Server", address: "10.0.0.100", port: 27015, game: "cstrike" },
    })
    serverId = server.serverId

    const player = await testPrisma.player.create({
      data: { lastName: "ActionPlayer", game: "cstrike", skill: 1000, createdAt: new Date() },
    })
    playerId = player.playerId
  })

  describe("findActionByCode", () => {
    it("should find an action by game and code", async () => {
      await getTestDb().action.create({
        data: {
          game: "cstrike",
          code: "bomb_planted",
          rewardPlayer: 5,
          rewardTeam: 2,
          team: "",
          description: "Planted the bomb",
          forPlayerActions: "1",
          forPlayerPlayerActions: "0",
          forTeamActions: "0",
          forWorldActions: "0",
        },
      })

      const action = await repo.findActionByCode("cstrike", "bomb_planted")
      expect(action).not.toBeNull()
      expect(action!.code).toBe("bomb_planted")
      expect(action!.rewardPlayer).toBe(5)
      expect(action!.forPlayerActions).toBe(true)
    })

    it("should prefer team-specific action when team is provided", async () => {
      await getTestDb().action.create({
        data: {
          game: "cstrike",
          code: "round_win",
          rewardPlayer: 0,
          rewardTeam: 3,
          team: "CT",
          description: "CT round win",
          forPlayerActions: "0",
          forPlayerPlayerActions: "0",
          forTeamActions: "1",
          forWorldActions: "0",
        },
      })

      const action = await repo.findActionByCode("cstrike", "round_win", "CT")
      expect(action).not.toBeNull()
      expect(action!.team).toBe("CT")
    })

    it("should return null for non-existent action", async () => {
      const action = await repo.findActionByCode("cstrike", "nonexistent_action")
      expect(action).toBeNull()
    })
  })

  describe("logPlayerAction", () => {
    it("should log a player action event", async () => {
      const action = await getTestDb().action.create({
        data: {
          game: "cstrike",
          code: "defuse_bomb",
          rewardPlayer: 10,
          rewardTeam: 0,
          team: "",
          description: "Defused the bomb",
          forPlayerActions: "1",
          forPlayerPlayerActions: "0",
          forTeamActions: "0",
          forWorldActions: "0",
        },
      })

      await repo.logPlayerAction(playerId, action.id, serverId, "de_dust2", 10)

      const events = await getTestDb().eventPlayerAction.findMany({
        where: { playerId, actionId: action.id },
      })
      expect(events).toHaveLength(1)
      expect(events[0]!.bonus).toBe(10)
      expect(events[0]!.map).toBe("de_dust2")
    })
  })

  describe("logTeamActionForPlayer", () => {
    it("should log a team bonus event", async () => {
      const action = await getTestDb().action.create({
        data: {
          game: "cstrike",
          code: "team_win",
          rewardPlayer: 0,
          rewardTeam: 5,
          team: "",
          description: "Team won",
          forPlayerActions: "0",
          forPlayerPlayerActions: "0",
          forTeamActions: "1",
          forWorldActions: "0",
        },
      })

      await repo.logTeamActionForPlayer(playerId, serverId, action.id, "de_dust2", 5)

      const events = await getTestDb().eventTeamBonus.findMany({
        where: { playerId },
      })
      expect(events).toHaveLength(1)
      expect(events[0]!.bonus).toBe(5)
    })
  })

  describe("logWorldAction", () => {
    it("should log a world action event", async () => {
      const action = await getTestDb().action.create({
        data: {
          game: "cstrike",
          code: "round_start",
          rewardPlayer: 0,
          rewardTeam: 0,
          team: "",
          description: "Round started",
          forPlayerActions: "0",
          forPlayerPlayerActions: "0",
          forTeamActions: "0",
          forWorldActions: "1",
        },
      })

      await repo.logWorldAction(serverId, action.id, "de_dust2")

      const events = await getTestDb().eventWorldAction.findMany({
        where: { serverId, actionId: action.id },
      })
      expect(events).toHaveLength(1)
    })
  })

  describe("logTeamActionBatch", () => {
    it("should batch-insert team bonus events", async () => {
      const action = await getTestDb().action.create({
        data: {
          game: "cstrike",
          code: "batch_win",
          rewardPlayer: 0,
          rewardTeam: 3,
          team: "",
          description: "Batch team win",
          forPlayerActions: "0",
          forPlayerPlayerActions: "0",
          forTeamActions: "1",
          forWorldActions: "0",
        },
      })

      const p2 = await getTestDb().player.create({
        data: { lastName: "BatchPlayer2", game: "cstrike", skill: 1000, createdAt: new Date() },
      })

      await repo.logTeamActionBatch([
        { playerId, serverId, actionId: action.id, map: "de_dust2", bonus: 3 },
        { playerId: p2.playerId, serverId, actionId: action.id, map: "de_dust2", bonus: 3 },
      ])

      const events = await getTestDb().eventTeamBonus.findMany({
        where: { actionId: action.id },
      })
      expect(events).toHaveLength(2)
    })
  })
})
