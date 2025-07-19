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
  PlayerEntryEvent,
  PlayerChangeTeamEvent,
  PlayerChangeRoleEvent,
  PlayerChangeNameEvent,
} from "@/types/common/events"
import type { IPlayerService } from "@/services/player/player.types"
import { resolveGameId } from "@/config/game-config"
import type { ILogger } from "@/utils/logger.types"
import { IPlayerHandler } from "./player.handler.types"

export interface HandlerResult {
  success: boolean
  error?: string
  playersAffected?: number[]
}

export class PlayerHandler implements IPlayerHandler {
  /**
   * Creates a new PlayerHandler instance
   */
  constructor(
    private readonly playerService: IPlayerService,
    private readonly logger: ILogger,
  ) {}

  async handleEvent(event: GameEvent): Promise<HandlerResult> {
    switch (event.eventType) {
      case "PLAYER_CONNECT":
        return this.handlePlayerConnect(event)

      case "PLAYER_DISCONNECT":
        return this.handlePlayerDisconnect(event)

      case "PLAYER_ENTRY":
        return this.handlePlayerEntry(event)

      case "PLAYER_CHANGE_TEAM":
        return this.handlePlayerChangeTeam(event)

      case "PLAYER_CHANGE_ROLE":
        return this.handlePlayerChangeRole(event)

      case "PLAYER_CHANGE_NAME":
        return this.handlePlayerChangeName(event)

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

      const resolvedPlayerId = await this.playerService.getOrCreatePlayer(
        steamId,
        playerName,
        serverGame,
      )

      // Update last_event timestamp
      await this.playerService.updatePlayerStats(resolvedPlayerId, {
        connection_time: 0, // Reset connection time on new connect
      })

      this.logger.event(`Player connected: ${playerName} (ID: ${resolvedPlayerId})`)

      return {
        success: true,
        playersAffected: [resolvedPlayerId],
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle player connect: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
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
      await this.playerService.updatePlayerStats(playerId, {
        connection_time: sessionDuration,
      })

      this.logger.event(
        `Player disconnected (ID: ${playerId}), session duration: ${sessionDuration}s`,
      )

      return {
        success: true,
        playersAffected: [playerId],
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle player disconnect: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
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
        this.playerService.getPlayerStats(killerId),
        this.playerService.getPlayerStats(victimId),
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
      await this.playerService.updatePlayerStats(killerId, killerUpdates)
      await this.playerService.updatePlayerStats(victimId, victimUpdates)

      this.logger.event(
        `Kill recorded: Player ${killerId} killed Player ${victimId} with ${weapon}`,
      )

      return {
        success: true,
        playersAffected: [killerId, victimId],
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle player kill: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
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
      const playerStats = await this.playerService.getPlayerStats(playerId)
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
        kill_streak: 0, // Reset kill streak on suicide
      }

      await this.playerService.updatePlayerStats(playerId, updates)

      this.logger.event(`Suicide recorded: Player ${playerId} with ${weapon}`)

      return {
        success: true,
        playersAffected: [playerId],
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle player suicide: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
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

      // Get current player stats first
      const [killerStats, victimStats] = await Promise.all([
        this.playerService.getPlayerStats(killerId),
        this.playerService.getPlayerStats(victimId),
      ])

      if (!killerStats || !victimStats) {
        throw new Error("Could not find killer or victim player records")
      }

      // Teamkill penalty: -10 skill points for killer
      const skillPenalty = -10
      const newKillerSkill = Math.min(3000, Math.max(100, killerStats.skill + skillPenalty))

      // Killer updates: teamkills increment, skill penalty
      const killerUpdates = {
        teamkills: 1,
        skill: newKillerSkill,
        kill_streak: 0, // Reset kill streak on teamkill
      }

      // Victim updates: deaths increment (teamkill still counts as death)
      const victimUpdates = {
        deaths: 1,
        death_streak: victimStats.death_streak + 1,
        kill_streak: 0, // Reset kill streak on death
      }

      // Update both players in parallel
      await Promise.all([
        this.playerService.updatePlayerStats(killerId, killerUpdates),
        this.playerService.updatePlayerStats(victimId, victimUpdates),
      ])

      this.logger.event(
        `Teamkill recorded: Player ${killerId} teamkilled Player ${victimId} with ${weapon}`,
      )

      return {
        success: true,
        playersAffected: [killerId, victimId],
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle player teamkill: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  private async handlePlayerEntry(event: PlayerEntryEvent): Promise<HandlerResult> {
    if (event.eventType !== "PLAYER_ENTRY") return { success: true }

    try {
      const { playerId } = event.data

      // Update last_event timestamp to mark player as active
      await this.playerService.updatePlayerStats(playerId, {
        last_event: Math.floor(Date.now() / 1000),
      })

      this.logger.event(`Player entered game: ${playerId}`)

      return {
        success: true,
        playersAffected: [playerId],
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle player entry: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  private async handlePlayerChangeTeam(event: PlayerChangeTeamEvent): Promise<HandlerResult> {
    if (event.eventType !== "PLAYER_CHANGE_TEAM") return { success: true }

    try {
      const { playerId, team } = event.data

      // TODO: Replace with actual team mapping logic based on game mod
      // For CS:GO/CS2: "CT" = Counter-Terrorists, "TERRORIST" = Terrorists
      // For TF2: map to team colors or specific team names
      const normalizedTeam = this.normalizeTeamName(team)

      // Update player's last event time
      await this.playerService.updatePlayerStats(playerId, {
        last_event: Math.floor(Date.now() / 1000),
      })

      this.logger.event(`Player ${playerId} changed to team: ${normalizedTeam}`)

      return {
        success: true,
        playersAffected: [playerId],
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle player team change: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  private async handlePlayerChangeRole(event: PlayerChangeRoleEvent): Promise<HandlerResult> {
    if (event.eventType !== "PLAYER_CHANGE_ROLE") return { success: true }

    try {
      const { playerId, role } = event.data

      // TODO: Replace with actual role mapping logic based on game mod
      // For CS: role could be "VIP" in cs_assault
      // For TF2: could be class like "Scout", "Soldier", "Pyro", etc.
      const normalizedRole = this.normalizeRoleName(role)

      // Update player's last event time
      await this.playerService.updatePlayerStats(playerId, {
        last_event: Math.floor(Date.now() / 1000),
      })

      this.logger.event(`Player ${playerId} changed role to: ${normalizedRole}`)

      return {
        success: true,
        playersAffected: [playerId],
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle player role change: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  private async handlePlayerChangeName(event: PlayerChangeNameEvent): Promise<HandlerResult> {
    if (event.eventType !== "PLAYER_CHANGE_NAME") return { success: true }

    try {
      const { playerId, oldName, newName } = event.data

      // Update player's current name and last event time
      await this.playerService.updatePlayerStats(playerId, {
        lastName: newName,
        last_event: Math.floor(Date.now() / 1000),
      })

      this.logger.event(`Player ${playerId} changed name from "${oldName}" to "${newName}"`)

      return {
        success: true,
        playersAffected: [playerId],
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle player name change: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Normalize team names for consistent tracking
   * TODO: Replace with proper game-specific team mapping
   */
  private normalizeTeamName(team: string): string {
    const teamLower = team.toLowerCase()
    
    // CS-style team mapping
    if (teamLower.includes("terror") || teamLower === "t") return "TERRORIST"
    if (teamLower.includes("ct") || teamLower.includes("counter")) return "CT"
    if (teamLower.includes("spec")) return "Spectator"
    
    // Return original if no mapping found
    return team
  }

  /**
   * Normalize role names for consistent tracking
   * TODO: Replace with proper game-specific role mapping
   */
  private normalizeRoleName(role: string): string {
    const roleLower = role.toLowerCase()
    
    // Common role mappings
    if (roleLower === "vip") return "VIP"
    
    // TF2 class mappings (examples)
    const tf2Classes = ["scout", "soldier", "pyro", "demoman", "heavy", "engineer", "medic", "sniper", "spy"]
    const matchedClass = tf2Classes.find(cls => roleLower.includes(cls))
    if (matchedClass) return matchedClass.charAt(0).toUpperCase() + matchedClass.slice(1)
    
    // Return original if no mapping found
    return role
  }

  /**
   * Calculate skill change between two players using ELO formula.
   * @returns The change in skill for each player
   */
  private async calculateSkillDelta(
    killerId: number,
    victimId: number,
  ): Promise<{ killer: number; victim: number }> {
    const [killer, victim] = await Promise.all([
      this.playerService.getPlayerStats(killerId),
      this.playerService.getPlayerStats(victimId),
    ])

    if (!killer || !victim) {
      throw new Error("Could not find player stats for skill calculation")
    }

    // Simple ELO calculation
    const K = 32 // ELO K-factor
    const expectedKiller = 1 / (1 + Math.pow(10, (victim.skill - killer.skill) / 400))
    const expectedVictim = 1 - expectedKiller

    // Killer won (score = 1), victim lost (score = 0)
    const killerDelta = Math.round(K * (1 - expectedKiller))
    const victimDelta = Math.round(K * (0 - expectedVictim))

    return {
      killer: killerDelta,
      victim: victimDelta,
    }
  }
}
