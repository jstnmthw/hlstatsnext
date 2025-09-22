/**
 * Server Message Command
 *
 * Handles scheduled server announcements, warnings, and informational messages.
 * Supports message formatting, player count filtering, and customizable content.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import type { IRconService } from "../../types/rcon.types"
import type { ServerInfo } from "@/modules/server/server.types"
import type {
  ScheduledCommand,
  ScheduleExecutionContext,
  ScheduleExecutionResult,
} from "../../types/schedule.types"
import { BaseScheduledCommand } from "./base-scheduled.command"

/**
 * Server message command executor for scheduled announcements
 */
export class ServerMessageCommand extends BaseScheduledCommand {
  constructor(logger: ILogger, rconService: IRconService) {
    super(logger, rconService)
  }

  /**
   * Get command type identifier
   */
  getType(): string {
    return "server-message"
  }

  /**
   * Validate that the command is a proper message command
   */
  protected async validateCommand(schedule: ScheduledCommand): Promise<boolean> {
    const command = typeof schedule.command === "string" ? schedule.command : ""

    // Check if it's a valid say command or similar
    const validMessageCommands = [
      "say",
      "say_team",
      "echo",
      "admin_say",
      "amx_say",
      "amx_csay",
      "amx_tsay",
    ]
    const isValidCommand = validMessageCommands.some((cmd) => command.toLowerCase().startsWith(cmd))

    if (!isValidCommand) {
      this.logger.warn(`Invalid message command for schedule ${schedule.id}: ${command}`)
      return false
    }

    // Validate message content
    const messageContent = this.extractMessageContent(command)
    if (!messageContent || messageContent.trim().length === 0) {
      this.logger.warn(`Empty message content for schedule ${schedule.id}`)
      return false
    }

    // Check message length (most game servers have limits)
    if (messageContent.length > 200) {
      this.logger.warn(
        `Message too long for schedule ${schedule.id}: ${messageContent.length} characters`,
      )
      return false
    }

    return true
  }

  /**
   * Validate execution context including player count filters
   */
  protected async validateExecution(context: ScheduleExecutionContext): Promise<void> {
    await super.validateExecution(context)

    const { schedule, server } = context

    // Check if server meets player count requirements
    if (!this.serverMatchesFilter(server, schedule)) {
      throw new Error(
        `Server ${server.serverId} does not meet filter criteria for schedule ${schedule.id}`,
      )
    }

    // Additional validation for message commands
    // Note: playerCount is not available in ServerInfo, would need server status
    // For now, we'll skip player count validation
    // TODO: Implement server status fetching for player count validation
  }

  /**
   * Process the response from the message command
   */
  protected async processResponse(
    response: string,
    context: ScheduleExecutionContext,
  ): Promise<string> {
    const { schedule, server } = context

    // Log successful message delivery
    const messageContent = this.extractMessageContent(this.getResolvedCommand(schedule, server))

    this.logger.info(`Server message delivered successfully`, {
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      serverId: server.serverId,
      serverName: server.name,
      playerCount: 0, // PlayerCount not available in ServerInfo
      messageContent: this.sanitizeMessageForLogging(messageContent),
      category: schedule.metadata?.category,
    })

    // Return a formatted response
    return `Message delivered: "${messageContent}" to ${0 /* server.playerCount not available */} players`
  }

  /**
   * Called after successful message execution
   */
  protected async onExecutionSuccess(
    result: ScheduleExecutionResult,
    context: ScheduleExecutionContext,
  ): Promise<void> {
    const { schedule, server } = context

    // Track message delivery metrics if needed
    if (schedule.metadata?.trackDelivery) {
      // This could be expanded to send metrics to a monitoring system
      this.logger.debug(`Message delivery tracked for schedule ${schedule.id}`, {
        scheduleId: schedule.id,
        serverId: server.serverId,
        executionTimeMs: result.executionTimeMs,
        playerCount: 0, // PlayerCount not available in ServerInfo
      })
    }

    // Handle special message categories
    const category = schedule.metadata?.category
    if (category === "announcement") {
      // Could trigger additional logging or notifications
      this.logger.debug(`Announcement delivered via schedule ${schedule.id}`)
    }
  }

  /**
   * Extract message content from say command
   */
  private extractMessageContent(command: string): string {
    // Handle different command formats:
    // say "message"
    // say message
    // admin_say "message"
    // amx_csay color "message"
    // amx_say "message"

    // Handle amx_csay with color parameter first (amx_csay color "message")
    const amxCsayMatch = command.match(/^amx_csay\s+\w+\s+"([^"]*)"/)
    if (amxCsayMatch !== null && amxCsayMatch[1] !== undefined) {
      return amxCsayMatch[1]
    }

    // Handle amx_say and amx_tsay with quoted content
    const amxQuotedMatch = command.match(/^(?:amx_say|amx_tsay)\s+"([^"]*)"/)
    if (amxQuotedMatch !== null && amxQuotedMatch[1] !== undefined) {
      return amxQuotedMatch[1]
    }

    // Handle standard say commands with quoted content
    const sayQuotedMatch = command.match(/^(?:say|say_team|admin_say|echo)\s+"([^"]*)"/)
    if (sayQuotedMatch !== null && sayQuotedMatch[1] !== undefined) {
      return sayQuotedMatch[1] // This can be empty string for 'say ""'
    }

    // Handle unquoted content for standard commands
    const sayUnquotedMatch = command.match(/^(?:say|say_team|admin_say|echo)\s+(.+)$/)
    if (sayUnquotedMatch?.[1]) {
      return sayUnquotedMatch[1]
    }

    // Handle amx commands with unquoted content
    const amxUnquotedMatch = command.match(/^(?:amx_say|amx_tsay)\s+(.+)$/)
    if (amxUnquotedMatch?.[1]) {
      return amxUnquotedMatch[1]
    }

    return ""
  }

  /**
   * Sanitize message for logging (remove potentially sensitive content)
   */
  private sanitizeMessageForLogging(message: string): string {
    // Truncate very long messages for logs
    if (message.length > 100) {
      return message.substring(0, 97) + "..."
    }
    return message
  }

  /**
   * Resolve command with dynamic message formatting
   */
  protected getResolvedCommand(schedule: ScheduledCommand, server: ServerInfo): string {
    if (typeof schedule.command === "function") {
      return schedule.command(server)
    }

    let command = schedule.command

    // Replace common placeholders in messages
    command = command.replace(/\{server\.name\}/g, server.name || "Unknown Server")
    command = command.replace(
      /\{server\.playerCount\}/g,
      (0) /* server.playerCount not available */
        ?.toString() || "0",
    )
    command = command.replace(
      /\{server\.maxPlayers\}/g,
      "N/A" /* maxPlayers not available in ServerInfo */,
    )
    command = command.replace(/\{time\.hour\}/g, new Date().getHours().toString().padStart(2, "0"))
    command = command.replace(
      /\{time\.minute\}/g,
      new Date().getMinutes().toString().padStart(2, "0"),
    )
    command = command.replace(/\{date\.day\}/g, new Date().getDate().toString())
    command = command.replace(/\{date\.month\}/g, (new Date().getMonth() + 1).toString())
    command = command.replace(/\{date\.year\}/g, new Date().getFullYear().toString())

    return command
  }

  /**
   * Enhanced server filter matching for message commands
   */
  protected serverMatchesFilter(server: ServerInfo, schedule: ScheduledCommand): boolean {
    if (!super.serverMatchesFilter(server, schedule)) {
      return false
    }

    const filter = schedule.serverFilter
    if (!filter) {
      return true
    }

    // Additional checks specific to message commands

    // Don't send messages to empty servers unless explicitly allowed
    const serverPlayerCount = 0 /* server.playerCount not available */
    if (filter.minPlayers !== undefined && serverPlayerCount < filter.minPlayers) {
      return false
    }

    // Check for quiet hours if specified in metadata
    if (schedule.metadata?.respectQuietHours) {
      const currentHour = new Date().getHours()
      const quietStart = (schedule.metadata.quietHoursStart as number) || 23
      const quietEnd = (schedule.metadata.quietHoursEnd as number) || 7

      if (quietStart > quietEnd) {
        // Crosses midnight (e.g., 23:00 to 07:00)
        if (currentHour >= quietStart || currentHour <= quietEnd) {
          return false
        }
      } else {
        // Same day (e.g., 02:00 to 05:00)
        if (currentHour >= quietStart && currentHour <= quietEnd) {
          return false
        }
      }
    }

    return true
  }
}
