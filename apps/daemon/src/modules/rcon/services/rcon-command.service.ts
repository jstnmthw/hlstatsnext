/**
 * Unified RCON Command Service
 *
 * Executes RCON commands using database-resolved command strings.
 * Handles batch optimization and message formatting automatically.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import type { IRconService } from "../rcon.types"
import { CommandResolverService, type CommandType } from "./command-resolver.service"

export interface RconCommandOptions {
  /** Override the default command type */
  commandType?: CommandType
  /** Force individual commands even if batch is supported */
  forceSingle?: boolean
  /** Delay between individual commands in batch (ms) */
  batchDelay?: number
}

export class RconCommandService {
  constructor(
    private readonly rconService: IRconService,
    private readonly commandResolver: CommandResolverService,
    private readonly logger: ILogger,
  ) {}

  /**
   * Execute RCON command with database-resolved command string
   */
  async execute(
    serverId: number,
    recipients: number[],
    message: string,
    options: RconCommandOptions = {},
  ): Promise<void> {
    if (recipients.length === 0) {
      return
    }

    const commandType = options.commandType || "BroadCastEventsCommand"

    try {
      const capabilities = await this.commandResolver.getCommandCapabilities(serverId, commandType)

      if (capabilities.supportsBatch && !options.forceSingle) {
        await this.executeBatch(
          serverId,
          recipients,
          message,
          commandType,
          capabilities.maxBatchSize,
          capabilities.requiresHashPrefix,
        )
      } else {
        await this.executeIndividual(
          serverId,
          recipients,
          message,
          commandType,
          capabilities.requiresHashPrefix,
          options.batchDelay,
        )
      }

      this.logger.debug(`Executed RCON command for ${recipients.length} recipients`, {
        serverId,
        commandType,
        recipientCount: recipients.length,
        batchMode: capabilities.supportsBatch && !options.forceSingle,
      })
    } catch (error) {
      this.logger.error(`Failed to execute RCON command on server ${serverId}`, {
        serverId,
        commandType,
        recipientCount: recipients.length,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Execute with batch optimization
   */
  private async executeBatch(
    serverId: number,
    recipients: number[],
    message: string,
    commandType: CommandType,
    maxBatchSize: number,
    requiresHashPrefix: boolean,
  ): Promise<void> {
    const command = await this.commandResolver.getCommand(serverId, commandType)
    const escapedMessage = this.escapeMessage(message)

    // Split recipients into batches
    const batches = this.chunkArray(recipients, maxBatchSize)

    for (const batch of batches) {
      let rconCommand: string

      if (command.includes("hlx_sm_psay")) {
        // SourceMod: comma-separated user IDs
        const userList = batch.join(",")
        rconCommand = `${command} ${userList} ${escapedMessage}`
      } else if (command.includes("hlx_amx_bulkpsay")) {
        // AMX bulk command: space-separated with hash prefix
        const userList = batch.map((id) => `#${id}`).join(" ")
        rconCommand = `${command} ${userList} ${escapedMessage}`
      } else {
        // Fallback to individual commands
        await this.executeIndividual(serverId, batch, message, commandType, requiresHashPrefix)
        continue
      }

      this.logCommand(serverId, rconCommand, batch)
      await this.rconService.executeCommand(serverId, rconCommand)
    }
  }

  /**
   * Execute individual commands for each recipient
   */
  private async executeIndividual(
    serverId: number,
    recipients: number[],
    message: string,
    commandType: CommandType,
    requiresHashPrefix: boolean,
    batchDelay?: number,
  ): Promise<void> {
    const command = await this.commandResolver.getCommand(serverId, commandType)
    const escapedMessage = this.escapeMessage(message)

    for (const recipient of recipients) {
      const userId = requiresHashPrefix ? `#${recipient}` : recipient.toString()
      const rconCommand = `${command} ${userId} ${escapedMessage}`

      this.logCommand(serverId, rconCommand, [recipient])
      await this.rconService.executeCommand(serverId, rconCommand)

      // Add delay between individual commands if specified
      if (batchDelay && batchDelay > 0 && recipients.length > 1) {
        await this.delay(batchDelay)
      }
    }
  }

  /**
   * Execute a public announcement command
   */
  async executeAnnouncement(
    serverId: number,
    message: string,
    commandType: CommandType = "BroadCastEventsCommandAnnounce",
  ): Promise<void> {
    try {
      const command = await this.commandResolver.getCommand(serverId, commandType)
      const escapedMessage = this.escapeMessage(message)

      // Handle special cases for announcement commands
      let rconCommand: string
      if (command.includes("ma_hlx_csay")) {
        // Mani requires #all suffix for global announcements
        rconCommand = `${command} #all ${escapedMessage}`
      } else if (command === "say") {
        // Plain say command for vanilla servers
        rconCommand = `say ${escapedMessage}`
      } else {
        // Most announcement commands work without player specification
        rconCommand = `${command} ${escapedMessage}`
      }

      this.logCommand(serverId, rconCommand, [])
      await this.rconService.executeCommand(serverId, rconCommand)
    } catch (error) {
      this.logger.error(`Failed to execute announcement command on server ${serverId}`, {
        serverId,
        commandType,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Escape message for safe RCON transmission
   */
  private escapeMessage(message: string): string {
    return message
      .replace(/"/g, '\\"') // Escape quotes
      .replace(/\n/g, "\\n") // Escape newlines
      .replace(/\r/g, "\\r") // Escape carriage returns
      .replace(/;/g, "\\;") // Escape semicolons (command separators)
  }

  /**
   * Split array into chunks of specified size
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  /**
   * Log command execution for debugging
   */
  private logCommand(serverId: number, command: string, recipients: number[]): void {
    this.logger.debug(`Executing RCON command`, {
      serverId,
      command: command.substring(0, 100) + (command.length > 100 ? "..." : ""),
      recipientCount: recipients.length,
      recipients: recipients.length <= 5 ? recipients : `${recipients.slice(0, 5)}...`,
    })
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
