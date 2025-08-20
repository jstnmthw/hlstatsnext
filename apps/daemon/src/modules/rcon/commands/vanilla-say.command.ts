/**
 * Vanilla Say Command
 *
 * Implements public chat messaging for servers without any MOD plugins.
 * Uses the standard "say" command and includes player names in messages
 * to make them effectively "targeted".
 */

import { BaseChatCommand } from "./base-chat.command"
import type { IRconService } from "../rcon.types"
import type { ILogger } from "@/shared/utils/logger.types"

export class VanillaSayCommand extends BaseChatCommand {
  constructor(rconService: IRconService, logger: ILogger) {
    super(rconService, logger)
  }

  async execute(serverId: number, recipients: number[], message: string): Promise<void> {
    if (recipients.length === 0) {
      return
    }

    try {
      // For vanilla servers, we broadcast public messages that include player context
      // Since we don't have player names here, we'll send a generic message
      const command = `say ${this.escapeMessage(message)}`

      this.logger.warn(`Executing vanilla say command`, {
        serverId,
        command: command.substring(0, 100) + (command.length > 100 ? "..." : ""),
        recipientCount: recipients.length,
      })

      await this.rconService.executeCommand(serverId, command)
    } catch (error) {
      this.logger.error(`Failed to execute vanilla say command on server ${serverId}`, {
        serverId,
        recipientCount: recipients.length,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Create a targeted public message that includes a player name
   */
  async executeWithPlayerName(
    serverId: number,
    playerName: string,
    message: string,
  ): Promise<void> {
    try {
      const targetedMessage = `${playerName}: ${message}`
      const command = `say ${this.escapeMessage(targetedMessage)}`

      this.logger.warn(`Executing targeted vanilla say command`, {
        serverId,
        command: command.substring(0, 100) + (command.length > 100 ? "..." : ""),
        playerName,
      })

      await this.rconService.executeCommand(serverId, command)
    } catch (error) {
      this.logger.error(`Failed to execute targeted vanilla say command on server ${serverId}`, {
        serverId,
        playerName,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }
}
