/**
 * Event Service for HLStats Daemon
 *
 * Handles all event-related database operations
 */

import type { DatabaseClient } from "@/database/client"
import { ILogger } from "@/utils/logger.types"
import type {
  GameEvent,
  PlayerConnectEvent,
  PlayerDisconnectEvent,
  PlayerKillEvent,
  PlayerChatEvent,
  PlayerSuicideEvent,
  PlayerTeamkillEvent,
  PlayerEntryEvent,
  PlayerChangeTeamEvent,
  PlayerChangeRoleEvent,
  PlayerChangeNameEvent,
  BombPlantEvent,
  BombDefuseEvent,
  BombExplodeEvent,
  HostageRescueEvent,
  HostageTouchEvent,
  FlagCaptureEvent,
  FlagDefendEvent,
  FlagPickupEvent,
  FlagDropEvent,
  ControlPointCaptureEvent,
  ControlPointDefendEvent,
  WeaponFireEvent,
  WeaponHitEvent,
  ServerStatsUpdateEvent,
} from "@/types/common/events"
import { IEventService } from "./event.types"

export class EventService implements IEventService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly logger: ILogger,
  ) {}

  /**
   * Create a new game event record
   */
  async createGameEvent(event: GameEvent): Promise<void> {
    try {
      // Map our event types to legacy HLStatsX event tables
      switch (event.eventType) {
        case "PLAYER_CONNECT":
          await this.createConnectEvent(event)
          break
        case "PLAYER_DISCONNECT":
          await this.createDisconnectEvent(event)
          break
        case "PLAYER_ENTRY":
          await this.createEntryEvent(event)
          break
        case "PLAYER_CHANGE_TEAM":
          await this.createChangeTeamEvent(event)
          break
        case "PLAYER_CHANGE_ROLE":
          await this.createChangeRoleEvent(event)
          break
        case "PLAYER_CHANGE_NAME":
          await this.createChangeNameEvent(event)
          break
        case "ACTION_PLAYER":
          // Handled by ActionHandler - EventService doesn't need to persist these
          // as ActionHandler handles both the event recording and database persistence
          break
        case "ACTION_PLAYER_PLAYER":
          // Handled by ActionHandler
          break
        case "ACTION_TEAM":
          // Handled by ActionHandler
          break
        case "PLAYER_KILL":
          await this.createFragEvent(event)
          break
        case "PLAYER_SUICIDE":
          await this.createSuicideEvent(event)
          break
        case "PLAYER_TEAMKILL":
          await this.createTeamkillEvent(event)
          break
        case "CHAT_MESSAGE":
          await this.createChatEvent(event)
          break
        case "ROUND_START":
        case "ROUND_END":
        case "TEAM_WIN":
        case "MAP_CHANGE":
          break
        case "BOMB_PLANT":
          await this.createBombPlantEvent(event)
          break
        case "BOMB_DEFUSE":
          await this.createBombDefuseEvent(event)
          break
        case "BOMB_EXPLODE":
          await this.createBombExplodeEvent(event)
          break
        case "HOSTAGE_RESCUE":
          await this.createHostageRescueEvent(event)
          break
        case "HOSTAGE_TOUCH":
          await this.createHostageTouchEvent(event)
          break
        case "FLAG_CAPTURE":
        case "FLAG_DEFEND":
        case "FLAG_PICKUP":
        case "FLAG_DROP":
        case "CONTROL_POINT_CAPTURE":
        case "CONTROL_POINT_DEFEND":
          await this.createObjectiveEvent(event)
          break
        case "WEAPON_FIRE":
          await this.createWeaponFireEvent(event)
          break
        case "WEAPON_HIT":
          await this.createWeaponHitEvent(event)
          break
        case "SERVER_STATS_UPDATE":
          await this.updateServerStats(event)
          break
        default:
          this.logger.warn(
            `Unhandled event type: ${(event as { eventType?: string })?.eventType ?? "unknown"}`,
          )
      }
    } catch (error) {
      this.logger.error(`Failed to create game event: ${error as string}`)
      throw error
    }
  }

  private async createConnectEvent(event: PlayerConnectEvent): Promise<void> {
    await this.db.prisma.eventConnect.create({
      data: {
        eventTime: event.timestamp,
        playerId: event.data.playerId,
        ipAddress: event.data.ipAddress || "",
        hostname: event.data.playerName || "",
        serverId: event.serverId,
        map: "", // Will be populated when we have map tracking
      },
    })
  }

  private async createDisconnectEvent(event: PlayerDisconnectEvent): Promise<void> {
    await this.db.prisma.eventDisconnect.create({
      data: {
        eventTime: event.timestamp,
        playerId: event.data.playerId,
        serverId: event.serverId,
        map: "", // Will be populated when we have map tracking
      },
    })
  }

  private async createFragEvent(event: PlayerKillEvent): Promise<void> {
    await this.db.prisma.eventFrag.create({
      data: {
        eventTime: event.timestamp,
        killerId: event.data.killerId,
        victimId: event.data.victimId,
        weapon: event.data.weapon,
        headshot: event.data.headshot ? 1 : 0,
        serverId: event.serverId,
        map: "", // Will be populated when we have map tracking
        pos_x: event.data.killerPosition?.x || 0,
        pos_y: event.data.killerPosition?.y || 0,
        pos_z: event.data.killerPosition?.z || 0,
        pos_victim_x: event.data.victimPosition?.x || 0,
        pos_victim_y: event.data.victimPosition?.y || 0,
        pos_victim_z: event.data.victimPosition?.z || 0,
      },
    })
  }

  private async createSuicideEvent(event: PlayerSuicideEvent): Promise<void> {
    await this.db.prisma.eventSuicide.create({
      data: {
        eventTime: event.timestamp,
        playerId: event.data.playerId,
        weapon: event.data.weapon || "world",
        serverId: event.serverId,
        map: "", // Will be populated when we have map tracking
        pos_x: event.data.position?.x || 0,
        pos_y: event.data.position?.y || 0,
        pos_z: event.data.position?.z || 0,
      },
    })
  }

  private async createTeamkillEvent(event: PlayerTeamkillEvent): Promise<void> {
    await this.db.prisma.eventTeamkill.create({
      data: {
        eventTime: event.timestamp,
        killerId: event.data.killerId,
        victimId: event.data.victimId,
        weapon: event.data.weapon,
        serverId: event.serverId,
        map: "", // Will be populated when we have map tracking
        pos_x: event.data.killerPosition?.x || 0,
        pos_y: event.data.killerPosition?.y || 0,
        pos_z: event.data.killerPosition?.z || 0,
        pos_victim_x: event.data.victimPosition?.x || 0,
        pos_victim_y: event.data.victimPosition?.y || 0,
        pos_victim_z: event.data.victimPosition?.z || 0,
      },
    })
  }

  private async createChatEvent(event: PlayerChatEvent): Promise<void> {
    await this.db.prisma.eventChat.create({
      data: {
        eventTime: event.timestamp,
        playerId: event.data.playerId,
        serverId: event.serverId,
        map: "", // Placeholder until map tracking implemented
        message_mode: event.data.isDead ? 1 : 0,
        message: event.data.message.substring(0, 128),
      },
    })
  }

  private async createEntryEvent(event: PlayerEntryEvent): Promise<void> {
    await this.db.prisma.eventEntry.create({
      data: {
        eventTime: event.timestamp,
        playerId: event.data.playerId,
        serverId: event.serverId,
        map: "", // TODO: Populate from server context
      },
    })
  }

  private async createChangeTeamEvent(event: PlayerChangeTeamEvent): Promise<void> {
    await this.db.prisma.eventChangeTeam.create({
      data: {
        eventTime: event.timestamp,
        playerId: event.data.playerId,
        team: event.data.team,
        serverId: event.serverId,
        map: "", // TODO: Populate from server context
      },
    })
  }

  private async createChangeRoleEvent(event: PlayerChangeRoleEvent): Promise<void> {
    await this.db.prisma.eventChangeRole.create({
      data: {
        eventTime: event.timestamp,
        playerId: event.data.playerId,
        role: event.data.role,
        serverId: event.serverId,
        map: "", // TODO: Populate from server context
      },
    })
  }

  private async createChangeNameEvent(event: PlayerChangeNameEvent): Promise<void> {
    await this.db.prisma.eventChangeName.create({
      data: {
        eventTime: event.timestamp,
        playerId: event.data.playerId,
        oldName: event.data.oldName,
        newName: event.data.newName,
        serverId: event.serverId,
        map: "", // TODO: Populate from server context
      },
    })
  }

  private async createBombPlantEvent(event: BombPlantEvent): Promise<void> {
    await this.db.prisma.eventPlayerAction.create({
      data: {
        eventTime: event.timestamp,
        playerId: event.data.playerId,
        serverId: event.serverId,
        map: "", // TODO: Populate from server context
        actionId: 1, // Will need to look up bomb plant action ID
        bonus: 3, // Bomb plant bonus points
        pos_x: event.data.position?.x || null,
        pos_y: event.data.position?.y || null,
        pos_z: event.data.position?.z || null,
      },
    })
  }

  private async createBombDefuseEvent(event: BombDefuseEvent): Promise<void> {
    await this.db.prisma.eventPlayerAction.create({
      data: {
        eventTime: event.timestamp,
        playerId: event.data.playerId,
        serverId: event.serverId,
        map: "", // TODO: Populate from server context
        actionId: 2, // Will need to look up bomb defuse action ID
        bonus: 3, // Bomb defuse bonus points
        pos_x: event.data.position?.x || null,
        pos_y: event.data.position?.y || null,
        pos_z: event.data.position?.z || null,
      },
    })
  }

  private async createBombExplodeEvent(event: BombExplodeEvent): Promise<void> {
    await this.db.prisma.eventWorldAction.create({
      data: {
        eventTime: event.timestamp,
        serverId: event.serverId,
        map: "", // TODO: Populate from server context
        actionId: 3, // Will need to look up bomb explode action ID
        bonus: 0,
      },
    })
  }

  private async createHostageRescueEvent(event: HostageRescueEvent): Promise<void> {
    await this.db.prisma.eventPlayerAction.create({
      data: {
        eventTime: event.timestamp,
        playerId: event.data.playerId,
        serverId: event.serverId,
        map: "", // TODO: Populate from server context
        actionId: 4, // Will need to look up hostage rescue action ID
        bonus: 2, // Hostage rescue bonus points
        pos_x: event.data.position?.x || null,
        pos_y: event.data.position?.y || null,
        pos_z: event.data.position?.z || null,
      },
    })
  }

  private async createHostageTouchEvent(event: HostageTouchEvent): Promise<void> {
    await this.db.prisma.eventPlayerAction.create({
      data: {
        eventTime: event.timestamp,
        playerId: event.data.playerId,
        serverId: event.serverId,
        map: "", // TODO: Populate from server context
        actionId: 5, // Will need to look up hostage touch action ID
        bonus: 1, // Hostage touch bonus points
        pos_x: event.data.position?.x || null,
        pos_y: event.data.position?.y || null,
        pos_z: event.data.position?.z || null,
      },
    })
  }

  private async createObjectiveEvent(
    event:
      | FlagCaptureEvent
      | FlagDefendEvent
      | FlagPickupEvent
      | FlagDropEvent
      | ControlPointCaptureEvent
      | ControlPointDefendEvent,
  ): Promise<void> {
    const actionIdMap: Record<string, number> = {
      FLAG_CAPTURE: 10,
      FLAG_DEFEND: 11,
      FLAG_PICKUP: 12,
      FLAG_DROP: 13,
      CONTROL_POINT_CAPTURE: 14,
      CONTROL_POINT_DEFEND: 15,
    }

    const bonusMap: Record<string, number> = {
      FLAG_CAPTURE: 5,
      FLAG_DEFEND: 3,
      FLAG_PICKUP: 1,
      FLAG_DROP: 0,
      CONTROL_POINT_CAPTURE: 4,
      CONTROL_POINT_DEFEND: 2,
    }

    await this.db.prisma.eventPlayerAction.create({
      data: {
        eventTime: event.timestamp,
        playerId: event.data.playerId,
        serverId: event.serverId,
        map: "", // TODO: Populate from server context
        actionId: actionIdMap[event.eventType] || 99,
        bonus: bonusMap[event.eventType] || 0,
        pos_x: event.data.position?.x || null,
        pos_y: event.data.position?.y || null,
        pos_z: event.data.position?.z || null,
      },
    })
  }

  private async updateServerStats(event: ServerStatsUpdateEvent): Promise<void> {
    const updateData: Record<string, unknown> = {}

    // Map event data to database fields
    if (event.data.kills !== undefined) updateData.kills = { increment: event.data.kills }
    if (event.data.players !== undefined) updateData.players = { increment: event.data.players }
    if (event.data.rounds !== undefined) updateData.rounds = { increment: event.data.rounds }
    if (event.data.suicides !== undefined) updateData.suicides = { increment: event.data.suicides }
    if (event.data.headshots !== undefined)
      updateData.headshots = { increment: event.data.headshots }
    if (event.data.bombsPlanted !== undefined)
      updateData.bombs_planted = { increment: event.data.bombsPlanted }
    if (event.data.bombsDefused !== undefined)
      updateData.bombs_defused = { increment: event.data.bombsDefused }
    if (event.data.ctWins !== undefined) updateData.ct_wins = { increment: event.data.ctWins }
    if (event.data.tsWins !== undefined) updateData.ts_wins = { increment: event.data.tsWins }
    if (event.data.actPlayers !== undefined) updateData.act_players = event.data.actPlayers
    if (event.data.maxPlayers !== undefined) updateData.max_players = event.data.maxPlayers
    if (event.data.actMap !== undefined) updateData.act_map = event.data.actMap
    if (event.data.mapRounds !== undefined)
      updateData.map_rounds = { increment: event.data.mapRounds }
    if (event.data.mapCtWins !== undefined)
      updateData.map_ct_wins = { increment: event.data.mapCtWins }
    if (event.data.mapTsWins !== undefined)
      updateData.map_ts_wins = { increment: event.data.mapTsWins }
    if (event.data.mapStarted !== undefined) updateData.map_started = event.data.mapStarted
    if (event.data.mapChanges !== undefined)
      updateData.map_changes = { increment: event.data.mapChanges }
    if (event.data.ctShots !== undefined) updateData.ct_shots = { increment: event.data.ctShots }
    if (event.data.ctHits !== undefined) updateData.ct_hits = { increment: event.data.ctHits }
    if (event.data.tsShots !== undefined) updateData.ts_shots = { increment: event.data.tsShots }
    if (event.data.tsHits !== undefined) updateData.ts_hits = { increment: event.data.tsHits }
    if (event.data.mapCtShots !== undefined)
      updateData.map_ct_shots = { increment: event.data.mapCtShots }
    if (event.data.mapCtHits !== undefined)
      updateData.map_ct_hits = { increment: event.data.mapCtHits }
    if (event.data.mapTsShots !== undefined)
      updateData.map_ts_shots = { increment: event.data.mapTsShots }
    if (event.data.mapTsHits !== undefined)
      updateData.map_ts_hits = { increment: event.data.mapTsHits }

    if (Object.keys(updateData).length > 0) {
      await this.db.prisma.server.update({
        where: { serverId: event.serverId },
        data: updateData,
      })
    }
  }

  private async createWeaponFireEvent(event: WeaponFireEvent): Promise<void> {
    // Create weapon fire event in database - this can be used for shot statistics
    // Note: This would typically map to a weapon_stats or event_weapon_fire table
    // For now, we'll just log it since the main purpose is to trigger ServerStatsHandler
    this.logger.debug(
      `Weapon fire event: player ${event.data.playerId} fired ${event.data.weaponCode}`,
    )
  }

  private async createWeaponHitEvent(event: WeaponHitEvent): Promise<void> {
    // Create weapon hit event in database - this can be used for hit statistics
    // Note: This would typically map to a weapon_stats or event_weapon_hit table
    // For now, we'll just log it since the main purpose is to trigger ServerStatsHandler
    this.logger.debug(
      `Weapon hit event: player ${event.data.playerId} hit ${event.data.victimId || "unknown"} with ${event.data.weaponCode}`,
    )
  }
}
