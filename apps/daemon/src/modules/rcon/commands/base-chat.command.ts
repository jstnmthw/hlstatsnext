/**
 * Base RCON Chat Command
 *
 * Abstract base class for all RCON chat commands that handles common
 * functionality like user ID formatting and message escaping.
 */

import type { IRconService } from "../types/rcon.types"
import type { ILogger } from "@/shared/utils/logger.types"

export interface IChatCommand {
  /**
   * Execute the command to send a message to the specified recipients
   */
  execute(serverId: number, recipients: number[], message: string): Promise<void>
}

export abstract class BaseChatCommand implements IChatCommand {
  constructor(
    protected readonly rconService: IRconService,
    protected readonly logger: ILogger,
  ) {}

  abstract execute(serverId: number, recipients: number[], message: string): Promise<void>

  /**
   * Format a single user ID (default implementation)
   */
  protected formatUserId(userId: number): string {
    return userId.toString()
  }

  /**
   * Escape and quote a message for safe RCON transmission
   */
  protected escapeMessage(message: string): string {
    // Remove or escape problematic characters
    const escaped = message
      .replace(/"/g, '\\"') // Escape quotes
      .replace(/\n/g, "\\n") // Escape newlines
      .replace(/\r/g, "\\r") // Escape carriage returns
      .replace(/\t/g, " ") // Replace tabs with spaces

    // Ensure message is quoted for RCON
    return `"${escaped}"`
  }
}
