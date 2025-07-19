/**
 * Server Statistics Handler
 *
 * Handles server-level statistics tracking and aggregation.
 * Generates server statistics events for real-time monitoring.
 */

import type { DatabaseClient } from "@/database/client"
import type { ILogger } from "@/utils/logger.types"
import type {
  GameEvent,
  PlayerKillEvent,
  ServerStatsUpdateEvent,
  TeamWinEvent,
  WeaponFireEvent,
  WeaponHitEvent,
} from "@/types/common/events"
import { EventType } from "@/types/common/events"

export interface ServerStatsSnapshot {
  serverId: number
  timestamp: Date
  kills: number
  players: number
  rounds: number
  suicides: number
  headshots: number
  bombsPlanted: number
  bombsDefused: number
  ctWins: number
  tsWins: number
  actPlayers: number
  maxPlayers: number
  actMap: string
  mapRounds: number
  mapCtWins: number
  mapTsWins: number
  mapStarted: number
  mapChanges: number
  ctShots: number
  ctHits: number
  tsShots: number
  tsHits: number
  mapCtShots: number
  mapCtHits: number
  mapTsShots: number
  mapTsHits: number
}

export interface IServerStatsHandler {
  handleEvent(event: GameEvent): Promise<void>
  getServerStats(serverId: number): Promise<ServerStatsSnapshot | null>
  generateStatsUpdateEvent(
    serverId: number,
    deltaStats: Partial<ServerStatsSnapshot>,
  ): ServerStatsUpdateEvent
  onStatsUpdate(callback: (event: ServerStatsUpdateEvent) => void): void
  offStatsUpdate(callback: (event: ServerStatsUpdateEvent) => void): void
}

export class ServerStatsHandler implements IServerStatsHandler {
  private statsSnapshots = new Map<number, ServerStatsSnapshot>()
  private statsUpdateCallbacks = new Set<(event: ServerStatsUpdateEvent) => void>()
  private handledEventTypes = new Set<EventType>([
    EventType.PLAYER_KILL,
    EventType.PLAYER_SUICIDE,
    EventType.BOMB_PLANT,
    EventType.BOMB_DEFUSE,
    EventType.TEAM_WIN,
    EventType.ROUND_END,
    EventType.MAP_CHANGE,
    EventType.PLAYER_CONNECT,
    EventType.PLAYER_DISCONNECT,
    EventType.WEAPON_FIRE,
    EventType.WEAPON_HIT,
  ])

  constructor(
    private readonly db: DatabaseClient,
    private readonly logger: ILogger,
  ) {}

  /**
   * Register a callback to be notified when server stats are updated
   */
  onStatsUpdate(callback: (event: ServerStatsUpdateEvent) => void): void {
    this.statsUpdateCallbacks.add(callback)
  }

  /**
   * Remove a stats update callback
   */
  offStatsUpdate(callback: (event: ServerStatsUpdateEvent) => void): void {
    this.statsUpdateCallbacks.delete(callback)
  }

  async handleEvent(event: GameEvent): Promise<void> {
    if (!this.handledEventTypes.has(event.eventType)) {
      return
    }

    this.logger.debug(
      `ServerStatsHandler processing event: ${event.eventType} for server ${event.serverId}`,
    )

    switch (event.eventType) {
      case EventType.PLAYER_KILL:
        await this.updateKillStats(event)
        break
      case EventType.PLAYER_SUICIDE:
        await this.updateSuicideStats(event)
        break
      case EventType.BOMB_PLANT:
        await this.updateBombStats(event, "plant")
        break
      case EventType.BOMB_DEFUSE:
        await this.updateBombStats(event, "defuse")
        break
      case EventType.TEAM_WIN:
        await this.updateTeamWinStats(event)
        break
      case EventType.ROUND_END:
        await this.updateRoundStats(event)
        break
      case EventType.MAP_CHANGE:
        await this.updateMapStats(event)
        break
      case EventType.PLAYER_CONNECT:
        await this.updatePlayerCountStats(event, "connect")
        break
      case EventType.PLAYER_DISCONNECT:
        await this.updatePlayerCountStats(event, "disconnect")
        break
      case EventType.WEAPON_FIRE:
        await this.updateWeaponStats(event, "shot")
        break
      case EventType.WEAPON_HIT:
        await this.updateWeaponStats(event, "hit")
        break
      default:
        // Event not relevant for server stats
        break
    }
  }

  async getServerStats(serverId: number): Promise<ServerStatsSnapshot | null> {
    try {
      const server = await this.db.prisma.server.findUnique({
        where: { serverId },
      })

      if (!server) {
        return null
      }

      return {
        serverId,
        timestamp: new Date(),
        kills: server.kills,
        players: server.players,
        rounds: server.rounds,
        suicides: server.suicides,
        headshots: server.headshots,
        bombsPlanted: server.bombs_planted,
        bombsDefused: server.bombs_defused,
        ctWins: server.ct_wins,
        tsWins: server.ts_wins,
        actPlayers: server.act_players,
        maxPlayers: server.max_players,
        actMap: server.act_map,
        mapRounds: server.map_rounds,
        mapCtWins: server.map_ct_wins,
        mapTsWins: server.map_ts_wins,
        mapStarted: server.map_started,
        mapChanges: server.map_changes,
        ctShots: server.ct_shots,
        ctHits: server.ct_hits,
        tsShots: server.ts_shots,
        tsHits: server.ts_hits,
        mapCtShots: server.map_ct_shots,
        mapCtHits: server.map_ct_hits,
        mapTsShots: server.map_ts_shots,
        mapTsHits: server.map_ts_hits,
      }
    } catch (error) {
      this.logger.error(`Failed to get server stats for server ${serverId}: ${error}`)
      return null
    }
  }

  generateStatsUpdateEvent(
    serverId: number,
    deltaStats: Partial<ServerStatsSnapshot>,
  ): ServerStatsUpdateEvent {
    return {
      eventType: EventType.SERVER_STATS_UPDATE,
      timestamp: new Date(),
      serverId,
      data: {
        kills: deltaStats.kills,
        players: deltaStats.players,
        rounds: deltaStats.rounds,
        suicides: deltaStats.suicides,
        headshots: deltaStats.headshots,
        bombsPlanted: deltaStats.bombsPlanted,
        bombsDefused: deltaStats.bombsDefused,
        ctWins: deltaStats.ctWins,
        tsWins: deltaStats.tsWins,
        actPlayers: deltaStats.actPlayers,
        maxPlayers: deltaStats.maxPlayers,
        actMap: deltaStats.actMap,
        mapRounds: deltaStats.mapRounds,
        mapCtWins: deltaStats.mapCtWins,
        mapTsWins: deltaStats.mapTsWins,
        mapStarted: deltaStats.mapStarted,
        mapChanges: deltaStats.mapChanges,
        ctShots: deltaStats.ctShots,
        ctHits: deltaStats.ctHits,
        tsShots: deltaStats.tsShots,
        tsHits: deltaStats.tsHits,
        mapCtShots: deltaStats.mapCtShots,
        mapCtHits: deltaStats.mapCtHits,
        mapTsShots: deltaStats.mapTsShots,
        mapTsHits: deltaStats.mapTsHits,
      },
    }
  }

  private async updateKillStats(event: GameEvent): Promise<void> {
    const serverId = event.serverId
    const deltaStats: Partial<ServerStatsSnapshot> = {
      kills: 1,
    }

    // Check if it's a headshot
    if (event.eventType === EventType.PLAYER_KILL && event.data.headshot) {
      deltaStats.headshots = 1
    }

    // Extract team information from killer to update team-specific shot/hit stats
    // Since we don't have separate WEAPON_FIRE/WEAPON_HIT events, we'll derive stats from kills
    if (event.eventType === EventType.PLAYER_KILL) {
      const killData = (event as PlayerKillEvent).data

      // Estimate shots and hits based on kill (this is an approximation)
      // In a real scenario, you'd get this from actual weapon fire events
      if (killData.killerTeam) {
        const team = killData.killerTeam.toLowerCase()

        this.logger.debug(
          `Kill event: team ${team} killed with ${killData.weapon} on server ${serverId}`,
        )

        if (team === "ct" || team === "counter-terrorist") {
          // Assume 1 hit per kill (minimum) and estimate shots based on weapon accuracy
          deltaStats.ctHits = 1
          deltaStats.ctShots = this.estimateShotsFromKill(killData.weapon)
        } else if (team === "t" || team === "terrorist") {
          deltaStats.tsHits = 1
          deltaStats.tsShots = this.estimateShotsFromKill(killData.weapon)
        }
      }
    }

    await this.emitStatsUpdate(serverId, deltaStats)
  }

  private estimateShotsFromKill(weapon: string = "unknown"): number {
    // Rough estimation of shots needed per kill based on weapon type
    // This is a fallback when we don't have actual shot tracking
    const weaponAccuracy: Record<string, number> = {
      awp: 1, // Sniper rifles are usually one shot
      ak47: 3, // Assault rifles
      ak74: 3,
      m4a1: 3,
      m4a4: 3,
      glock: 5, // Pistols
      usp: 4,
      deagle: 2,
      knife: 1, // Melee
      hegrenade: 1, // Grenades
      default: 3, // Default assumption
    }

    const weaponKey = weapon.toLowerCase().replace(/[^a-z0-9]/g, "")
    return weaponAccuracy[weaponKey] ?? weaponAccuracy.default ?? 3
  }

  private async updateSuicideStats(event: GameEvent): Promise<void> {
    const serverId = event.serverId
    const deltaStats: Partial<ServerStatsSnapshot> = {
      suicides: 1,
    }

    await this.emitStatsUpdate(serverId, deltaStats)
  }

  private async updateBombStats(event: GameEvent, action: "plant" | "defuse"): Promise<void> {
    const serverId = event.serverId
    const deltaStats: Partial<ServerStatsSnapshot> = {}

    this.logger.info(`[DEBUG] Updating bomb stats: ${action} for server ${serverId}`)

    if (action === "plant") {
      deltaStats.bombsPlanted = 1
      this.logger.info(`[DEBUG] Server ${serverId}: Bomb planted, incrementing bombs_planted`)
    } else if (action === "defuse") {
      deltaStats.bombsDefused = 1
      this.logger.info(`[DEBUG] Server ${serverId}: Bomb defused, incrementing bombs_defused`)
    }

    await this.emitStatsUpdate(serverId, deltaStats)
  }

  private async updateTeamWinStats(event: GameEvent): Promise<void> {
    const serverId = event.serverId

    if (event.eventType === EventType.TEAM_WIN) {
      const deltaStats: Partial<ServerStatsSnapshot> = {}
      const winningTeam = (event as TeamWinEvent).data.winningTeam

      this.logger.info(`[DEBUG] Team win detected: ${winningTeam} on server ${serverId}`)

      if (winningTeam === "CT" || winningTeam === "COUNTER-TERRORIST") {
        deltaStats.ctWins = 1
        deltaStats.mapCtWins = 1
        this.logger.info(`[DEBUG] Server ${serverId}: CT win, incrementing ct_wins and map_ct_wins`)
      } else if (winningTeam === "TERRORIST" || winningTeam === "T") {
        deltaStats.tsWins = 1
        deltaStats.mapTsWins = 1
        this.logger.info(`[DEBUG] Server ${serverId}: TS win, incrementing ts_wins and map_ts_wins`)
      } else {
        this.logger.warn(`[DEBUG] Unrecognized winning team: ${winningTeam} on server ${serverId}`)
      }

      if (Object.keys(deltaStats).length > 0) {
        await this.emitStatsUpdate(serverId, deltaStats)
      }
    } else {
      this.logger.warn(`Team win event missing required data on server ${serverId}`)
    }
  }

  private async updateRoundStats(event: GameEvent): Promise<void> {
    const serverId = event.serverId
    const deltaStats: Partial<ServerStatsSnapshot> = {
      rounds: 1,
      mapRounds: 1,
    }

    await this.emitStatsUpdate(serverId, deltaStats)
  }

  private async updateMapStats(event: GameEvent): Promise<void> {
    const serverId = event.serverId
    const deltaStats: Partial<ServerStatsSnapshot> = {
      mapChanges: 1,
      mapStarted: Math.floor(Date.now() / 1000),
    }

    if (event.eventType === EventType.MAP_CHANGE) {
      deltaStats.actMap = event.data.newMap
    }

    await this.emitStatsUpdate(serverId, deltaStats)
  }

  private async updatePlayerCountStats(
    event: GameEvent,
    action: "connect" | "disconnect",
  ): Promise<void> {
    const serverId = event.serverId
    const deltaStats: Partial<ServerStatsSnapshot> = {}

    this.logger.info(`[DEBUG] Updating player count stats: ${action} for server ${serverId}`)

    if (action === "connect") {
      deltaStats.players = 1
    }

    // Get current active player count from database
    try {
      const server = await this.db.prisma.server.findUnique({
        where: { serverId },
      })

      if (server) {
        const currentPlayers =
          action === "connect" ? server.act_players + 1 : Math.max(0, server.act_players - 1)
        deltaStats.actPlayers = currentPlayers

        this.logger.info(`[DEBUG] Server ${serverId}: Previous act_players: ${server.act_players}, New act_players: ${currentPlayers}`)

        // Update max players if needed
        if (currentPlayers > server.max_players) {
          deltaStats.maxPlayers = currentPlayers
          this.logger.info(`[DEBUG] Server ${serverId}: New max_players: ${currentPlayers}`)
        }
      } else {
        this.logger.warn(`[DEBUG] Server ${serverId} not found in database`)
      }
    } catch (error) {
      this.logger.error(`Failed to update player count stats for server ${serverId}: ${error}`)
    }

    await this.emitStatsUpdate(serverId, deltaStats)
  }

  private async updateWeaponStats(event: GameEvent, type: "shot" | "hit"): Promise<void> {
    const serverId = event.serverId

    if (event.eventType === EventType.WEAPON_FIRE || event.eventType === EventType.WEAPON_HIT) {
      const data = (event as WeaponFireEvent | WeaponHitEvent).data
      const deltaStats: Partial<ServerStatsSnapshot> = {}
      const team = String(data.team).toLowerCase()

      // Update team-specific shot/hit statistics
      if (team === "ct" || team === "counter-terrorist") {
        if (type === "shot") {
          deltaStats.ctShots = 1
        } else if (type === "hit") {
          deltaStats.ctHits = 1
        }
      } else if (team === "t" || team === "terrorist") {
        if (type === "shot") {
          deltaStats.tsShots = 1
        } else if (type === "hit") {
          deltaStats.tsHits = 1
        }
      }

      await this.emitStatsUpdate(serverId, deltaStats)
    }
  }

  private async emitStatsUpdate(
    serverId: number,
    deltaStats: Partial<ServerStatsSnapshot>,
  ): Promise<void> {
    try {
      // First, update the database with the statistics
      await this.updateDatabaseStats(serverId, deltaStats)

      const updateEvent = this.generateStatsUpdateEvent(serverId, deltaStats)

      // Notify all registered callbacks
      for (const callback of this.statsUpdateCallbacks) {
        try {
          callback(updateEvent)
        } catch (error) {
          this.logger.error(`Error in stats update callback: ${error}`)
        }
      }

      this.logger.debug(
        `Server stats updated for server ${serverId}: ${JSON.stringify(deltaStats)}`,
      )
    } catch (error) {
      this.logger.error(`Failed to emit stats update for server ${serverId}: ${error}`)
    }
  }

  private async updateDatabaseStats(
    serverId: number,
    deltaStats: Partial<ServerStatsSnapshot>,
  ): Promise<void> {
    try {
      const updateData: Record<string, unknown> = {}

      // Build the update object based on delta stats
      if (deltaStats.kills !== undefined) {
        updateData.kills = { increment: deltaStats.kills }
      }
      if (deltaStats.players !== undefined) {
        updateData.players = { increment: deltaStats.players }
      }
      if (deltaStats.rounds !== undefined) {
        updateData.rounds = { increment: deltaStats.rounds }
      }
      if (deltaStats.suicides !== undefined) {
        updateData.suicides = { increment: deltaStats.suicides }
      }
      if (deltaStats.headshots !== undefined) {
        updateData.headshots = { increment: deltaStats.headshots }
      }
      if (deltaStats.bombsPlanted !== undefined) {
        updateData.bombs_planted = { increment: deltaStats.bombsPlanted }
      }
      if (deltaStats.bombsDefused !== undefined) {
        updateData.bombs_defused = { increment: deltaStats.bombsDefused }
      }
      if (deltaStats.ctWins !== undefined) {
        updateData.ct_wins = { increment: deltaStats.ctWins }
        updateData.map_ct_wins = { increment: deltaStats.ctWins }
      }
      if (deltaStats.tsWins !== undefined) {
        updateData.ts_wins = { increment: deltaStats.tsWins }
        updateData.map_ts_wins = { increment: deltaStats.tsWins }
      }
      if (deltaStats.mapRounds !== undefined) {
        updateData.map_rounds = { increment: deltaStats.mapRounds }
      }
      if (deltaStats.mapChanges !== undefined) {
        updateData.map_changes = { increment: deltaStats.mapChanges }
      }
      if (deltaStats.mapStarted !== undefined) {
        updateData.map_started = deltaStats.mapStarted
      }
      if (deltaStats.actMap !== undefined) {
        updateData.act_map = deltaStats.actMap
      }
      if (deltaStats.actPlayers !== undefined) {
        updateData.act_players = deltaStats.actPlayers
      }
      if (deltaStats.maxPlayers !== undefined) {
        updateData.max_players = deltaStats.maxPlayers
      }
      if (deltaStats.ctShots !== undefined) {
        updateData.ct_shots = { increment: deltaStats.ctShots }
        updateData.map_ct_shots = { increment: deltaStats.ctShots }
      }
      if (deltaStats.ctHits !== undefined) {
        updateData.ct_hits = { increment: deltaStats.ctHits }
        updateData.map_ct_hits = { increment: deltaStats.ctHits }
      }
      if (deltaStats.tsShots !== undefined) {
        updateData.ts_shots = { increment: deltaStats.tsShots }
        updateData.map_ts_shots = { increment: deltaStats.tsShots }
      }
      if (deltaStats.tsHits !== undefined) {
        updateData.ts_hits = { increment: deltaStats.tsHits }
        updateData.map_ts_hits = { increment: deltaStats.tsHits }
      }

      // Only update if there's something to update
      if (Object.keys(updateData).length > 0) {
        this.logger.debug(`Updating server ${serverId} with data: ${JSON.stringify(updateData)}`)
        await this.db.prisma.server.update({
          where: { serverId },
          data: updateData,
        })
        this.logger.debug(`Successfully updated server ${serverId} statistics`)
      } else {
        this.logger.debug(`No data to update for server ${serverId}`)
      }
    } catch (error) {
      this.logger.error(`Failed to update database stats for server ${serverId}: ${error}`)
      throw error
    }
  }
}
