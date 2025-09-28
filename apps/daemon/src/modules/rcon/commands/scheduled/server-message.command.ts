/**
 * Server Message Command
 *
 * Handles scheduled server announcements, warnings, and informational messages.
 * Supports message formatting, player count filtering, and customizable content.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import type { IRconService } from "../../types/rcon.types"
import type { IServerService } from "@/modules/server/server.types"
import type { ScheduledCommand, ScheduleExecutionContext } from "../../types/schedule.types"
import { BaseScheduledCommand } from "./base-scheduled.command"

/**
 * Server message command executor for scheduled announcements
 */
export class ServerMessageCommand extends BaseScheduledCommand {
  constructor(
    logger: ILogger,
    rconService: IRconService,
    private readonly serverService: IServerService,
  ) {
    super(logger, rconService)
  }

  /**
   * Get command type identifier
   */
  getType(): string {
    return "server-message"
  }

  /**
   * Execute the server message command across applicable servers
   */
  protected async executeCommand(context: ScheduleExecutionContext): Promise<{
    serversProcessed: number
    commandsSent: number
  }> {
    const { schedule } = context

    // Get command content - support both old string format and new object format
    let commandContent: string
    if (typeof schedule.command === "object" && schedule.command.message) {
      const type = schedule.command.type as string
      const message = schedule.command.message as string
      // Format as RCON command: type "message"
      commandContent = `${type} "${message}"`
    } else if (typeof schedule.command === "string") {
      commandContent = schedule.command
    } else {
      this.logger.warn(`Invalid message command for schedule ${schedule.id}`)
      return { serversProcessed: 0, commandsSent: 0 }
    }

    this.logger.info(`Executing server message command: ${schedule.id}`, {
      scheduleId: schedule.id,
      command: commandContent,
    })

    // Discover active servers with RCON capabilities
    const servers = await this.serverService.findActiveServersWithRcon()

    if (servers.length === 0) {
      this.logger.info("No active servers found for message command execution")
      return { serversProcessed: 0, commandsSent: 0 }
    }

    let serversProcessed = 0
    let commandsSent = 0

    // Execute command on each server
    for (const server of servers) {
      try {
        // Check if RCON is connected
        if (!this.rconService.isConnected(server.serverId)) {
          this.logger.debug(`RCON not connected for server ${server.serverId}, skipping`)
          continue
        }

        // Replace placeholders in command content
        const processedCommand = this.replacePlaceholders(commandContent, server)

        // Execute the command
        await this.rconService.executeCommand(server.serverId, processedCommand)
        commandsSent++
        serversProcessed++

        this.logger.info("Server message delivered successfully", {
          scheduleId: schedule.id,
          serverId: server.serverId,
          command: processedCommand,
        })
        this.logger.debug(`Message command executed successfully on server ${server.serverId}`)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        this.logger.warn(
          `Failed to execute message command on server ${server.serverId}: ${errorMessage}`,
        )
        serversProcessed++
      }
    }

    this.logger.debug(`Message command execution completed`, {
      scheduleId: schedule.id,
      serversProcessed,
      commandsSent,
    })

    return { serversProcessed, commandsSent }
  }

  /**
   * Validate that the command is a proper message command
   */
  protected async validateCommand(schedule: ScheduledCommand): Promise<boolean> {
    // Handle both object and string command formats
    let command: string
    if (typeof schedule.command === "object") {
      // New object format: { type: "server-message", message: "..." }
      if (!schedule.command.type) {
        this.logger.warn(`Invalid command structure for schedule ${schedule.id}`)
        return false
      }

      if (!schedule.command.message) {
        this.logger.warn(`Empty message content for schedule ${schedule.id}`)
        return false
      }

      // Check if it's a valid message command type
      const validMessageTypes = [
        "server-message",
        "say",
        "say_team",
        "echo",
        "admin_say",
        "amx_say",
        "amx_csay",
        "amx_tsay",
        "hlx_tsay",
        "hlx_csay",
        "hlx_typehud",
      ]

      if (!validMessageTypes.includes(schedule.command.type)) {
        this.logger.warn(
          `Invalid message command type for schedule ${schedule.id}: ${schedule.command.type}`,
        )
        return false
      }

      command = schedule.command.message as string
    } else if (typeof schedule.command === "string") {
      // Legacy string format: "say Hello World"
      command = schedule.command

      // Check if it's a valid say command or similar
      const validMessageCommands = [
        "say",
        "say_team",
        "echo",
        "admin_say",
        "amx_say",
        "amx_csay",
        "amx_tsay",
        "hlx_tsay",
        "hlx_csay",
        "hlx_typehud",
      ]
      const isValidCommand = validMessageCommands.some((cmd) =>
        command.toLowerCase().startsWith(cmd),
      )

      // Also check for generic hlx_ commands (future-proof for new hlx commands)
      const isHlxCommand = /^hlx_\w+/.test(command.toLowerCase())

      if (!isValidCommand && !isHlxCommand) {
        // Check if this might be a message-like command we don't know about
        // Look for typical message command patterns: contains quotes, has message-like keywords
        const mightBeMessageCommand =
          command.includes('"') || /(?:say|message|msg|chat|tell|announce)/i.test(command)

        if (mightBeMessageCommand) {
          this.logger.warn(`Unknown message command for schedule ${schedule.id}: ${command}`)
          // For commands that look like messages, we'll be permissive
        } else {
          this.logger.warn(`Invalid message command for schedule ${schedule.id}: ${command}`)
          return false // Clearly not a message command
        }
      }

      // For string commands, extract the message content for validation
      const messageContent = this.extractMessageContent(command)
      if (!messageContent || messageContent.trim().length === 0) {
        this.logger.warn(`Empty message content for schedule ${schedule.id}: ${command}`)
        // Only fail validation if we can't extract any message content
        // This handles cases where our regex doesn't cover all command formats
        if (isValidCommand || isHlxCommand) {
          this.logger.warn(`Skipping schedule ${schedule.id} due to empty message content`)
          return false // Known commands should have extractable content
        } else {
          // For unknown commands that look like messages, check if they have quoted content
          const hasQuotedContent = /"[^"]+"/g.test(command)
          if (hasQuotedContent) {
            this.logger.info(
              `Allowing unknown message command with quoted content for schedule ${schedule.id}`,
            )
            return true // Assume quoted content is the message
          } else {
            this.logger.warn(`Skipping schedule ${schedule.id} due to no extractable content`)
            return false // No extractable or quoted content
          }
        }
      }
      command = messageContent
    } else {
      this.logger.warn(`Invalid command format for schedule ${schedule.id}`)
      return false
    }

    // Validate message content length (applies to both formats)
    if (!command || command.trim().length === 0) {
      this.logger.warn(`Empty message content for schedule ${schedule.id}`)
      return false
    }

    // Check message length (most game servers have limits)
    if (command.length > 200) {
      this.logger.warn(`Message too long for schedule ${schedule.id}: ${command.length} characters`)
      return false
    }

    return true
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

    // Handle amx_csay and hlx_ commands with color parameter first (color "message" format)
    const colorCommandMatch = command.match(
      /^(?:amx_csay|hlx_tsay|hlx_csay|hlx_typehud)\s+\w+\s+"([^"]*)"/,
    )
    if (colorCommandMatch !== null && colorCommandMatch[1] !== undefined) {
      return colorCommandMatch[1]
    }

    // Handle hlx_ and amx_ commands with color parameter and unquoted message
    const colorUnquotedMatch = command.match(
      /^(?:amx_csay|hlx_tsay|hlx_csay|hlx_typehud)\s+\w+\s+(.+)$/,
    )
    if (colorUnquotedMatch?.[1]) {
      return colorUnquotedMatch[1]
    }

    // Handle amx_say, amx_tsay, and hlx_ commands with quoted content (no color parameter)
    const amxQuotedMatch = command.match(
      /^(?:amx_say|amx_tsay|hlx_tsay|hlx_csay|hlx_typehud)\s+"([^"]*)"/,
    )
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

    // Handle amx and hlx commands with unquoted content (no color parameter)
    const amxUnquotedMatch = command.match(
      /^(?:amx_say|amx_tsay|hlx_tsay|hlx_csay|hlx_typehud)\s+(.+)$/,
    )
    if (amxUnquotedMatch?.[1]) {
      return amxUnquotedMatch[1]
    }

    return ""
  }

  /**
   * Replace placeholders in command content with server-specific values
   */
  private replacePlaceholders(command: string, server: { serverId: number; name: string }): string {
    return command
      .replace(/\{server\.name\}/g, server.name)
      .replace(/\{server\.playerCount\}/g, "0") // TODO: Get actual player count
      .replace(/\{server\.maxPlayers\}/g, "N/A") // TODO: Get actual max players
      .replace(/\{server\.serverId\}/g, server.serverId.toString())
  }
}
