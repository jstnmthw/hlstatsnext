/**
 * Event Notification Service
 *
 * Central service for handling all game event notifications.
 * Coordinates between event data, color formatting, message building,
 * and the underlying notification delivery system.
 */

import { EventType } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import { StructuredCommandBuilder } from "../builders/structured-command.builder"
import type { INotificationConfigRepository } from "../repositories/notification-config.repository"
import type {
  ActionEventNotificationData,
  ConnectEventNotificationData,
  DisconnectEventNotificationData,
  KillEventNotificationData,
  SuicideEventNotificationData,
  TeamActionEventNotificationData,
  TeamKillEventNotificationData,
} from "../types/notification.types"
import { CommandResolverService } from "./command-resolver.service"
import { PlayerNotificationService } from "./player-notification.service"

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
    private readonly commandResolver: CommandResolverService,
    private readonly logger: ILogger,
  ) {}

  async notifyKillEvent(data: KillEventNotificationData): Promise<void> {
    try {
      // Check if kill events are enabled
      if (!(await this.isEventTypeEnabled(data.serverId, EventType.PLAYER_KILL))) {
        return
      }

      // Get command prefix from database configuration
      const commandPrefix = await this.commandResolver.getCommand(
        data.serverId,
        "BroadCastEventsCommand",
      )

      // Build structured command
      const command = StructuredCommandBuilder.buildKillCommand(commandPrefix, data)

      // Execute the command (target 0 = all players)
      await this.playerNotificationService.executeRawCommand(data.serverId, command)

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

      // Get command prefix from database configuration
      const commandPrefix = await this.commandResolver.getCommand(
        data.serverId,
        "BroadCastEventsCommand",
      )

      // Build structured command
      const command = StructuredCommandBuilder.buildSuicideCommand(commandPrefix, data)

      // Execute the command (target 0 = all players)
      await this.playerNotificationService.executeRawCommand(data.serverId, command)

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

      // Get command prefix from database configuration
      const commandPrefix = await this.commandResolver.getCommand(
        data.serverId,
        "BroadCastEventsCommand",
      )

      // Build structured command
      const command = StructuredCommandBuilder.buildTeamKillCommand(commandPrefix, data)

      // Execute the command (target 0 = all players)
      await this.playerNotificationService.executeRawCommand(data.serverId, command)

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

      // Get command prefix from database configuration
      const commandPrefix = await this.commandResolver.getCommand(
        data.serverId,
        "BroadCastEventsCommand",
      )

      // Build structured command
      const command = StructuredCommandBuilder.buildActionCommand(commandPrefix, data)

      // Execute the command (target 0 = all players)
      await this.playerNotificationService.executeRawCommand(data.serverId, command)

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

      // Get command prefix from database configuration
      const commandPrefix = await this.commandResolver.getCommand(
        data.serverId,
        "BroadCastEventsCommand",
      )

      // Build structured command
      const command = StructuredCommandBuilder.buildTeamActionCommand(commandPrefix, data)

      // Execute the command (target 0 = all players)
      await this.playerNotificationService.executeRawCommand(data.serverId, command)

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

      // Get command prefix from database configuration
      const commandPrefix = await this.commandResolver.getCommand(
        data.serverId,
        "BroadCastEventsCommand",
      )

      // Build structured command
      const command = StructuredCommandBuilder.buildConnectCommand(commandPrefix, data)

      // Execute the command (target 0 = all players)
      await this.playerNotificationService.executeRawCommand(data.serverId, command)

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

      // Get command prefix from database configuration
      const commandPrefix = await this.commandResolver.getCommand(
        data.serverId,
        "BroadCastEventsCommand",
      )

      // Build structured command
      const command = StructuredCommandBuilder.buildDisconnectCommand(commandPrefix, data)

      // Execute the command (target 0 = all players)
      await this.playerNotificationService.executeRawCommand(data.serverId, command)

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
   * Get server configuration with defaults
   */
}
