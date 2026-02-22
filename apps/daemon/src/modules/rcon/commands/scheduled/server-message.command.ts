/**
 * Server Message Command
 *
 * Handles scheduled server announcements via RCON.
 * Builds HUD commands from {type, color, message} config:
 *   - "hlx_csay"    → hlx_csay <color> <message>  (center HUD)
 *   - "hlx_tsay"    → hlx_tsay <color> <message>  (top HUD)
 *   - "hlx_typehud" → hlx_typehud <color> <message> (typewriter HUD)
 */

import type { IServerService } from "@/modules/server/server.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IRconService } from "../../types/rcon.types"
import type { ScheduledCommand, ScheduleExecutionContext } from "../../types/schedule.types"
import { BaseScheduledCommand } from "./base-scheduled.command"

/** Supported HUD command types (must match AMX plugin commands) */
const VALID_TYPES = new Set(["hlx_csay", "hlx_tsay", "hlx_typehud"])

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

  getType(): string {
    return "server-message"
  }

  protected async executeCommand(context: ScheduleExecutionContext): Promise<{
    serversProcessed: number
    commandsSent: number
  }> {
    const { schedule } = context

    const rconCommand = this.buildRconCommand(schedule)
    if (!rconCommand) {
      this.logger.warn(`Could not build RCON command for schedule ${schedule.id}`)
      return { serversProcessed: 0, commandsSent: 0 }
    }

    const servers = await this.serverService.findActiveServersWithRcon()
    if (servers.length === 0) {
      this.logger.info("No active servers found for message command execution")
      return { serversProcessed: 0, commandsSent: 0 }
    }

    let serversProcessed = 0
    let commandsSent = 0

    for (const server of servers) {
      try {
        if (!this.rconService.isConnected(server.serverId)) {
          this.logger.debug(`RCON not connected for server ${server.serverId}, skipping`)
          continue
        }

        const processedCommand = this.replacePlaceholders(rconCommand, server)
        await this.rconService.executeCommand(server.serverId, processedCommand)
        commandsSent++
        serversProcessed++

        this.logger.info("Server message delivered successfully", {
          scheduleId: schedule.id,
          serverId: server.serverId,
          command: processedCommand,
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        this.logger.warn(
          `Failed to execute message command on server ${server.serverId}: ${errorMessage}`,
        )
        serversProcessed++
      }
    }

    return { serversProcessed, commandsSent }
  }

  protected async validateCommand(schedule: ScheduledCommand): Promise<boolean> {
    if (typeof schedule.command !== "object" || !schedule.command.message) {
      this.logger.warn(`Missing message for schedule ${schedule.id}`)
      return false
    }

    const type = schedule.command.type as string
    if (!VALID_TYPES.has(type)) {
      this.logger.warn(`Invalid command type for schedule ${schedule.id}: ${type}`)
      return false
    }

    const message = schedule.command.message as string
    if (!message.trim()) {
      this.logger.warn(`Empty message for schedule ${schedule.id}`)
      return false
    }

    if (message.length > 200) {
      this.logger.warn(`Message too long for schedule ${schedule.id}: ${message.length} characters`)
      return false
    }

    return true
  }

  /**
   * Build the RCON command: <type> <color> <message>
   */
  private buildRconCommand(schedule: ScheduledCommand): string | null {
    if (typeof schedule.command !== "object" || !schedule.command.message) {
      return null
    }

    const type = schedule.command.type as string
    if (!VALID_TYPES.has(type)) {
      return null
    }

    const message = schedule.command.message as string
    const color = (schedule.command.color as string) || "00FF00"

    return `${type} ${color} ${message}`
  }

  private replacePlaceholders(command: string, server: { serverId: number; name: string }): string {
    return command
      .replace(/\{server\.name\}/g, server.name)
      .replace(/\{server\.serverId\}/g, server.serverId.toString())
  }
}
