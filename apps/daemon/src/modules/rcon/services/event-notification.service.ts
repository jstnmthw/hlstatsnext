/**
 * Event Notification Service
 *
 * Central service for handling all game event notifications.
 * Coordinates between event data, color formatting, message building,
 * and the underlying notification delivery system.
 */

import { EventType } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IRankingService } from "@/modules/ranking/ranking.types"
import type { IServerService } from "@/modules/server/server.types"
import { PlayerNotificationService } from "./player-notification.service"
import { NotificationMessageBuilder } from "../builders/notification-message.builder"
import { ColorFormatterFactory, type EngineType } from "../formatters/color-formatter.factory"
import type { INotificationConfigRepository } from "../repositories/notification-config.repository"
import type {
  KillEventNotificationData,
  SuicideEventNotificationData,
  TeamKillEventNotificationData,
  ActionEventNotificationData,
  TeamActionEventNotificationData,
  ConnectEventNotificationData,
  DisconnectEventNotificationData,
  MessageTemplates,
} from "../types/notification.types"

export interface IEventNotificationService {
  /**
   * Notify about kill events with skill adjustments and ranks
   */
  notifyKillEvent(data: KillEventNotificationData): Promise<void>

  /**
   * Notify about suicide events with skill penalties
   */
  notifySuicideEvent(data: SuicideEventNotificationData): Promise<void>

  /**
   * Notify about team kill events with penalties
   */
  notifyTeamKillEvent(data: TeamKillEventNotificationData): Promise<void>

  /**
   * Notify about individual player actions
   */
  notifyActionEvent(data: ActionEventNotificationData): Promise<void>

  /**
   * Notify about team-wide actions
   */
  notifyTeamActionEvent(data: TeamActionEventNotificationData): Promise<void>

  /**
   * Notify about player connections (optional)
   */
  notifyConnectEvent(data: ConnectEventNotificationData): Promise<void>

  /**
   * Notify about player disconnections (optional)
   */
  notifyDisconnectEvent(data: DisconnectEventNotificationData): Promise<void>

  /**
   * Check if notifications are enabled for a specific event type
   */
  isEventTypeEnabled(serverId: number, eventType: EventType): Promise<boolean>
}

export class EventNotificationService implements IEventNotificationService {
  constructor(
    private readonly playerNotificationService: PlayerNotificationService,
    private readonly configRepository: INotificationConfigRepository,
    private readonly rankingService: IRankingService,
    private readonly serverService: IServerService,
    private readonly logger: ILogger,
  ) {}

  async notifyKillEvent(data: KillEventNotificationData): Promise<void> {
    try {
      // Check if kill events are enabled
      if (!(await this.isEventTypeEnabled(data.serverId, EventType.PLAYER_KILL))) {
        return
      }

      // Build the notification message
      const message = await this.buildKillMessage(data)

      // Send as public announcement
      await this.playerNotificationService.broadcastAnnouncement(
        data.serverId,
        message,
        "BroadCastEventsCommandAnnounce",
      )

      this.logger.info(`Kill notification sent for server ${data.serverId}`, {
        serverId: data.serverId,
        killerId: data.killerId,
        victimId: data.victimId,
        killerSkill: data.killerSkill,
        victimSkill: data.victimSkill,
        points: data.skillAdjustment.killerChange,
      })
    } catch (error) {
      this.logger.error(`Failed to send kill notification for server ${data.serverId}`, {
        serverId: data.serverId,
        killerId: data.killerId,
        victimId: data.victimId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  async notifySuicideEvent(data: SuicideEventNotificationData): Promise<void> {
    try {
      // Check if suicide events are enabled
      if (!(await this.isEventTypeEnabled(data.serverId, EventType.PLAYER_SUICIDE))) {
        return
      }

      // Build the notification message
      const message = await this.buildSuicideMessage(data)

      // Send as public announcement
      await this.playerNotificationService.broadcastAnnouncement(
        data.serverId,
        message,
        "BroadCastEventsCommandAnnounce",
      )

      this.logger.info(`Suicide notification sent for server ${data.serverId}`, {
        serverId: data.serverId,
        playerId: data.playerId,
        playerSkill: data.playerSkill,
        penalty: data.skillPenalty,
      })
    } catch (error) {
      this.logger.error(`Failed to send suicide notification for server ${data.serverId}`, {
        serverId: data.serverId,
        playerId: data.playerId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  async notifyTeamKillEvent(data: TeamKillEventNotificationData): Promise<void> {
    try {
      // Check if team kill events are enabled
      if (!(await this.isEventTypeEnabled(data.serverId, EventType.PLAYER_TEAMKILL))) {
        return
      }

      // Build the notification message
      const message = await this.buildTeamKillMessage(data)

      // Send as public announcement
      await this.playerNotificationService.broadcastAnnouncement(
        data.serverId,
        message,
        "BroadCastEventsCommandAnnounce",
      )

      this.logger.info(`Team kill notification sent for server ${data.serverId}`, {
        serverId: data.serverId,
        killerId: data.killerId,
        victimId: data.victimId,
        penalty: data.skillPenalty,
      })
    } catch (error) {
      this.logger.error(`Failed to send team kill notification for server ${data.serverId}`, {
        serverId: data.serverId,
        killerId: data.killerId,
        victimId: data.victimId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  async notifyActionEvent(data: ActionEventNotificationData): Promise<void> {
    try {
      // Check if action events are enabled
      if (!(await this.isEventTypeEnabled(data.serverId, EventType.ACTION_PLAYER))) {
        return
      }

      // Build the notification message
      const message = await this.buildActionMessage(data)

      // Send as public announcement
      await this.playerNotificationService.broadcastAnnouncement(
        data.serverId,
        message,
        "BroadCastEventsCommandAnnounce",
      )

      this.logger.info(`Action notification sent for server ${data.serverId}`, {
        serverId: data.serverId,
        playerId: data.playerId,
        action: data.actionCode,
        points: data.points,
      })
    } catch (error) {
      this.logger.error(`Failed to send action notification for server ${data.serverId}`, {
        serverId: data.serverId,
        playerId: data.playerId,
        action: data.actionCode,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  async notifyTeamActionEvent(data: TeamActionEventNotificationData): Promise<void> {
    try {
      // Check if team action events are enabled
      if (!(await this.isEventTypeEnabled(data.serverId, EventType.ACTION_TEAM))) {
        return
      }

      // Build the notification message
      const message = await this.buildTeamActionMessage(data)

      // Send as public announcement
      await this.playerNotificationService.broadcastAnnouncement(
        data.serverId,
        message,
        "BroadCastEventsCommandAnnounce",
      )

      this.logger.info(`Team action notification sent for server ${data.serverId}`, {
        serverId: data.serverId,
        team: data.team,
        action: data.actionCode,
        points: data.points,
      })
    } catch (error) {
      this.logger.error(`Failed to send team action notification for server ${data.serverId}`, {
        serverId: data.serverId,
        team: data.team,
        action: data.actionCode,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  async notifyConnectEvent(data: ConnectEventNotificationData): Promise<void> {
    try {
      // Check if connect events are enabled
      if (!(await this.isEventTypeEnabled(data.serverId, EventType.PLAYER_CONNECT))) {
        return
      }

      // Build the notification message
      const message = await this.buildConnectMessage(data)

      // Send as public announcement
      await this.playerNotificationService.broadcastAnnouncement(
        data.serverId,
        message,
        "BroadCastEventsCommandAnnounce",
      )

      this.logger.debug(`Connect notification sent for server ${data.serverId}`, {
        serverId: data.serverId,
        playerId: data.playerId,
      })
    } catch (error) {
      this.logger.error(`Failed to send connect notification for server ${data.serverId}`, {
        serverId: data.serverId,
        playerId: data.playerId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  async notifyDisconnectEvent(data: DisconnectEventNotificationData): Promise<void> {
    try {
      // Check if disconnect events are enabled
      if (!(await this.isEventTypeEnabled(data.serverId, EventType.PLAYER_DISCONNECT))) {
        return
      }

      // Build the notification message
      const message = await this.buildDisconnectMessage(data)

      // Send as public announcement
      await this.playerNotificationService.broadcastAnnouncement(
        data.serverId,
        message,
        "BroadCastEventsCommandAnnounce",
      )

      this.logger.debug(`Disconnect notification sent for server ${data.serverId}`, {
        serverId: data.serverId,
        playerId: data.playerId,
        sessionDuration: data.sessionDuration,
      })
    } catch (error) {
      this.logger.error(`Failed to send disconnect notification for server ${data.serverId}`, {
        serverId: data.serverId,
        playerId: data.playerId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  async isEventTypeEnabled(serverId: number, eventType: EventType): Promise<boolean> {
    try {
      return await this.configRepository.isEventTypeEnabled(serverId, eventType)
    } catch (error) {
      this.logger.warn(`Failed to check if event type is enabled, defaulting to true`, {
        serverId,
        eventType,
        error: error instanceof Error ? error.message : String(error),
      })
      return true // Default to enabled on error
    }
  }

  /**
   * Build kill event message with color formatting
   */
  private async buildKillMessage(data: KillEventNotificationData): Promise<string> {
    const config = await this.getServerConfig(data.serverId)
    const formatter = ColorFormatterFactory.create(
      this.validateEngineType(config.engineType),
      config.colorEnabled,
      config.colorScheme,
    )

    return NotificationMessageBuilder.create()
      .withColorFormatter(formatter)
      .withTemplates(this.parseMessageFormats(config.messageFormats))
      .fromKillEvent(data)
      .build()
  }

  /**
   * Build suicide event message with color formatting
   */
  private async buildSuicideMessage(data: SuicideEventNotificationData): Promise<string> {
    const config = await this.getServerConfig(data.serverId)
    const formatter = ColorFormatterFactory.create(
      this.validateEngineType(config.engineType),
      config.colorEnabled,
      config.colorScheme,
    )

    return NotificationMessageBuilder.create()
      .withColorFormatter(formatter)
      .withTemplates(this.parseMessageFormats(config.messageFormats))
      .fromSuicideEvent(data)
      .build()
  }

  /**
   * Build team kill event message with color formatting
   */
  private async buildTeamKillMessage(data: TeamKillEventNotificationData): Promise<string> {
    const config = await this.getServerConfig(data.serverId)
    const formatter = ColorFormatterFactory.create(
      this.validateEngineType(config.engineType),
      config.colorEnabled,
      config.colorScheme,
    )

    return NotificationMessageBuilder.create()
      .withColorFormatter(formatter)
      .withTemplates(this.parseMessageFormats(config.messageFormats))
      .fromTeamKillEvent(data)
      .build()
  }

  /**
   * Build action event message with color formatting
   */
  private async buildActionMessage(data: ActionEventNotificationData): Promise<string> {
    const config = await this.getServerConfig(data.serverId)
    const formatter = ColorFormatterFactory.create(
      this.validateEngineType(config.engineType),
      config.colorEnabled,
      config.colorScheme,
    )

    return NotificationMessageBuilder.create()
      .withColorFormatter(formatter)
      .withTemplates(this.parseMessageFormats(config.messageFormats))
      .fromActionEvent(data)
      .build()
  }

  /**
   * Build team action event message with color formatting
   */
  private async buildTeamActionMessage(data: TeamActionEventNotificationData): Promise<string> {
    const config = await this.getServerConfig(data.serverId)
    const formatter = ColorFormatterFactory.create(
      this.validateEngineType(config.engineType),
      config.colorEnabled,
      config.colorScheme,
    )

    return NotificationMessageBuilder.create()
      .withColorFormatter(formatter)
      .withTemplates(this.parseMessageFormats(config.messageFormats))
      .fromTeamActionEvent(data)
      .build()
  }

  /**
   * Build connect event message with color formatting
   */
  private async buildConnectMessage(data: ConnectEventNotificationData): Promise<string> {
    const config = await this.getServerConfig(data.serverId)
    const formatter = ColorFormatterFactory.create(
      this.validateEngineType(config.engineType),
      config.colorEnabled,
      config.colorScheme,
    )

    return NotificationMessageBuilder.create()
      .withColorFormatter(formatter)
      .withTemplates(this.parseMessageFormats(config.messageFormats))
      .fromConnectEvent(data)
      .build()
  }

  /**
   * Build disconnect event message with color formatting
   */
  private async buildDisconnectMessage(data: DisconnectEventNotificationData): Promise<string> {
    const config = await this.getServerConfig(data.serverId)
    const formatter = ColorFormatterFactory.create(
      this.validateEngineType(config.engineType),
      config.colorEnabled,
      config.colorScheme,
    )

    return NotificationMessageBuilder.create()
      .withColorFormatter(formatter)
      .withTemplates(this.parseMessageFormats(config.messageFormats))
      .fromDisconnectEvent(data)
      .build()
  }

  /**
   * Get server configuration with defaults
   */
  private async getServerConfig(serverId: number) {
    try {
      // Get server info to determine engine type
      const server = await this.serverService.findById(serverId)
      const engineType = this.determineEngineType(server?.game || "unknown")

      return await this.configRepository.getConfigWithDefaults(serverId, engineType)
    } catch (error) {
      this.logger.warn(`Failed to get server config for ${serverId}, using defaults`, {
        serverId,
        error: error instanceof Error ? error.message : String(error),
      })

      // Return safe defaults
      return {
        serverId,
        engineType: "goldsrc",
        colorEnabled: false,
        colorScheme: null,
        eventTypes: null,
        messageFormats: null,
      }
    }
  }

  /**
   * Determine engine type from game code
   */
  private determineEngineType(game: string): EngineType {
    // Map game codes to engine types
    const gameToEngine: Record<string, EngineType> = {
      cstrike: "goldsrc",
      cs: "goldsrc",
      "1.6": "goldsrc",
      valve: "goldsrc",
      hldm: "goldsrc",
      tf: "goldsrc",

      css: "source",
      hl2mp: "source",
      tf2: "source",

      csgo: "source",
      cs2: "source2",
    }

    return gameToEngine[game.toLowerCase()] || "goldsrc"
  }

  /**
   * Parse and validate message formats from JSON
   */
  private parseMessageFormats(messageFormats: unknown): Partial<MessageTemplates> {
    if (!messageFormats || typeof messageFormats !== "object") {
      return {}
    }

    // Return as partial message templates (validation happens in builder)
    return messageFormats as Partial<MessageTemplates>
  }

  /**
   * Validate and convert engine type string to EngineType
   */
  private validateEngineType(engineType: string): EngineType {
    const validTypes: EngineType[] = ["goldsrc", "source", "source2"]
    return validTypes.includes(engineType as EngineType) ? (engineType as EngineType) : "goldsrc"
  }
}
