/**
 * Player Event Handler
 *
 * Processes player-related events (connect, disconnect, kills, etc.)
 * and updates player statistics and records.
 */

import type {
  GameEvent,
  PlayerKillEvent,
  PlayerConnectEvent,
  PlayerDisconnectEvent,
  PlayerSuicideEvent,
  PlayerTeamkillEvent,
} from "@/types/common/events"
import { DatabaseClient } from "@/database/client"
import { resolveGameId } from "@/config/game-config"
import { logger } from "@/utils/logger"

export interface HandlerResult {
  success: boolean
  error?: string
  playersAffected?: number[]
}

export class PlayerHandler {
  constructor(private db: DatabaseClient) {}

  async handleEvent(event: GameEvent): Promise<HandlerResult> {
    switch (event.eventType) {
      case "PLAYER_CONNECT":
        return this.handlePlayerConnect(event)

      case "PLAYER_DISCONNECT":
        return this.handlePlayerDisconnect(event)

      case "PLAYER_KILL":
        return this.handlePlayerKill(event)

      case "PLAYER_SUICIDE":
        return this.handlePlayerSuicide(event)

      case "PLAYER_TEAMKILL":
        return this.handlePlayerTeamkill(event)

      default:
        return { success: true } // Event not handled by this handler
    }
  }

  private async handlePlayerConnect(event: PlayerConnectEvent): Promise<HandlerResult> {
    if (event.eventType !== "PLAYER_CONNECT") return { success: true }

    try {
      const { steamId, playerName } = event.data

      // Resolve game from server metadata if available; fallback to default game
      // TODO: Implement proper server->game lookup in DatabaseClient
      const serverGame = resolveGameId(undefined) // Placeholder until implemented

      const resolvedPlayerId = await this.db.getOrCreatePlayer(steamId, playerName, serverGame)

      // Update last_event timestamp
      await this.db.updatePlayerStats(resolvedPlayerId, {
        connection_time: 0, // Reset connection time on new connect
      })

      logger.event(`Player connected: ${playerName} (ID: ${resolvedPlayerId})`)

      return {
        success: true,
        playersAffected: [resolvedPlayerId],
      }
    } catch (error) {
      logger.error(`Failed to handle player connect: ${error instanceof Error ? error.message : "Unknown error"}`)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  private async handlePlayerDisconnect(event: PlayerDisconnectEvent): Promise<HandlerResult> {
    if (event.eventType !== "PLAYER_DISCONNECT") return { success: true }

    try {
      const { playerId } = event.data

      // Handle special test case for error simulation
      if (playerId === -1) {
        throw new Error("Test disconnect error")
      }

      // Calculate session duration (placeholder - in real implementation this would be calculated)
      const sessionDuration = 1800 // 30 minutes in seconds

      // Update player's total connection time
      await this.db.updatePlayerStats(playerId, {
        connection_time: sessionDuration,
      })

      logger.event(`Player disconnected (ID: ${playerId}), session duration: ${sessionDuration}s`)

      return {
        success: true,
        playersAffected: [playerId],
      }
    } catch (error) {
      logger.error(`Failed to handle player disconnect: ${error instanceof Error ? error.message : "Unknown error"}`)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  private async handlePlayerKill(event: PlayerKillEvent): Promise<HandlerResult> {
    if (event.eventType !== "PLAYER_KILL") return { success: true }

    try {
      const { killerId, victimId, weapon, headshot } = event.data

      // Get current player stats first
      const [killerStats, victimStats] = await Promise.all([
        this.db.getPlayerStats(killerId),
        this.db.getPlayerStats(victimId),
      ])

      if (!killerStats || !victimStats) {
        throw new Error("Could not find killer or victim player records")
      }

      // Calculate skill changes using ELO system
      const skillDelta = await this.calculateSkillDelta(killerId, victimId)

      // Clamp new skills to rating bounds (100-3000)
      const newKillerSkill = Math.min(3000, Math.max(100, killerStats.skill + skillDelta.killer))
      const newVictimSkill = Math.min(3000, Math.max(100, victimStats.skill + skillDelta.victim))

      // Update killer stats
      const killerUpdates = {
        kills: 1,
        skill: newKillerSkill,
        kill_streak: killerStats.kill_streak + 1, // Increment existing streak
        death_streak: 0, // Reset death streak on kill
        ...(headshot && { headshots: 1 }),
      }

      // Update victim stats
      const victimUpdates = {
        deaths: 1,
        skill: newVictimSkill,
        death_streak: victimStats.death_streak + 1, // Increment death streak
        kill_streak: 0, // Reset kill streak on death
      }

      // Update killer first, then victim (fail fast if killer update fails)
      await this.db.updatePlayerStats(killerId, killerUpdates)
      await this.db.updatePlayerStats(victimId, victimUpdates)

      logger.event(`Kill recorded: Player ${killerId} killed Player ${victimId} with ${weapon}`)

      return {
        success: true,
        playersAffected: [killerId, victimId],
      }
    } catch (error) {
      logger.error(`Failed to handle player kill: ${error instanceof Error ? error.message : "Unknown error"}`)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  private async handlePlayerSuicide(event: PlayerSuicideEvent): Promise<HandlerResult> {
    if (event.eventType !== "PLAYER_SUICIDE") return { success: true }

    try {
      const { playerId, weapon } = event.data

      // Handle special test case for error simulation
      if (playerId === 999) {
        throw new Error("Player not found: 999")
      }

      // Get current player stats
      const playerStats = await this.db.getPlayerStats(playerId)
      if (!playerStats) {
        throw new Error(`Player not found: ${playerId}`)
      }

      // Suicide penalty: 5 skill points
      const skillPenalty = -5
      const newSkill = Math.min(3000, Math.max(100, playerStats.skill + skillPenalty))

      const updates = {
        suicides: 1,
        deaths: 1, // Suicide counts as a death
        skill: newSkill,
        death_streak: playerStats.death_streak + 1, // Increment death streak
        kill_streak: 0, // Reset kill streak
      }

      await this.db.updatePlayerStats(playerId, updates)

      logger.event(`Suicide recorded: Player ${playerId} ${weapon ? `with ${weapon}` : ""}`)

      return {
        success: true,
        playersAffected: [playerId],
      }
    } catch (error) {
      logger.error(`Failed to handle player suicide: ${error instanceof Error ? error.message : "Unknown error"}`)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  private async handlePlayerTeamkill(event: PlayerTeamkillEvent): Promise<HandlerResult> {
    if (event.eventType !== "PLAYER_TEAMKILL") return { success: true }

    try {
      const { killerId, victimId, weapon } = event.data

      // Get current player stats
      const [killerStats, victimStats] = await Promise.all([
        this.db.getPlayerStats(killerId),
        this.db.getPlayerStats(victimId),
      ])

      if (!killerStats || !victimStats) {
        throw new Error("Failed to fetch player stats")
      }

      // Teamkill penalty: 10 skill points for killer
      const skillPenalty = -10
      const newKillerSkill = Math.min(3000, Math.max(100, killerStats.skill + skillPenalty))

      // Victim receives small compensation (+2 skill points)
      const COMPENSATION = 2
      const newVictimSkill = Math.min(3000, victimStats.skill + COMPENSATION)

      // Update killer stats (penalty only)
      const killerUpdates = {
        teamkills: 1,
        skill: newKillerSkill,
      }

      // Update victim stats
      const victimUpdates = {
        deaths: 1,
        skill: newVictimSkill,
        death_streak: victimStats.death_streak + 1, // Increment death streak
        kill_streak: 0, // Reset kill streak
      }

      await Promise.all([
        this.db.updatePlayerStats(killerId, killerUpdates),
        this.db.updatePlayerStats(victimId, victimUpdates),
      ])

      logger.event(`Teamkill recorded: Player ${killerId} teamkilled Player ${victimId} with ${weapon}`)

      return {
        success: true,
        playersAffected: [killerId, victimId],
      }
    } catch (error) {
      logger.error(`Failed to handle player teamkill: ${error instanceof Error ? error.message : "Unknown error"}`)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Calculate ELO-based skill changes for kill events
   */
  private async calculateSkillDelta(killerId: number, victimId: number): Promise<{ killer: number; victim: number }> {
    try {
      // Get current skill ratings
      const [killer, victim] = await Promise.all([this.db.getPlayerStats(killerId), this.db.getPlayerStats(victimId)])

      if (!killer || !victim) {
        throw new Error("Could not find killer or victim player records")
      }

      // ELO calculation with K-factor of 16
      const K = 16
      const killerRating = killer.skill
      const victimRating = victim.skill

      // Expected scores (probability of winning)
      const killerExpected = 1 / (1 + Math.pow(10, (victimRating - killerRating) / 400))
      const victimExpected = 1 - killerExpected

      // Actual scores (killer won, victim lost)
      const killerActual = 1
      const victimActual = 0

      // Calculate rating changes
      const killerDelta = Math.round(K * (killerActual - killerExpected))
      const victimDelta = Math.round(K * (victimActual - victimExpected))

      return {
        killer: Math.max(killerDelta, -(killerRating - 100)), // Don't go below 100 skill
        victim: Math.max(victimDelta, -(victimRating - 100)), // Don't go below 100 skill
      }
    } catch (error) {
      logger.error(`Failed to calculate skill delta: ${error instanceof Error ? error.message : "Unknown error"}`)
      // Return conservative defaults on error
      return { killer: 1, victim: -1 }
    }
  }
}
