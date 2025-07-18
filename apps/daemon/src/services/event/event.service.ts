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
        default:
          this.logger.warn(`Unhandled event type: ${event.eventType}`)
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
}
