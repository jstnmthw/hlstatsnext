/**
 * Command Response Handler
 *
 * Handles parsing of RCON command responses, including error detection
 * and response format validation.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import { RconError, RconErrorCode } from "../rcon.types"

/**
 * Types of response handling results
 */
export type ResponseHandlingResult =
  | { type: "success"; response: string }
  | { type: "error"; error: RconError }

/**
 * Handles command response parsing and validation
 */
export class CommandResponseHandler {
  constructor(private readonly logger: ILogger) {}

  /**
   * Parses RCON command response from buffer
   */
  parseCommandResponse(buffer: Buffer, command: string): ResponseHandlingResult {
    try {
      const response = this.extractResponseText(buffer)

      // Check for known error patterns
      const errorResult = this.checkForErrors(response, command)
      if (errorResult) {
        return { type: "error", error: errorResult }
      }

      this.logger.debug(`GoldSrc RCON: Command '${command}' executed successfully`, {
        responseLength: response.length,
        responsePreview: response.substring(0, 200),
      })

      return { type: "success", response }
    } catch (error) {
      const rconError = new RconError(
        `Failed to parse response: ${error instanceof Error ? error.message : "Unknown error"}`,
        RconErrorCode.COMMAND_FAILED,
      )

      return { type: "error", error: rconError }
    }
  }

  /**
   * Extracts response text from buffer based on GoldSrc format
   */
  private extractResponseText(buffer: Buffer): string {
    // Check for standard response format (0xFF 0xFF 0xFF 0xFF followed by type marker)
    if (
      buffer.length > 5 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xff &&
      buffer[2] === 0xff &&
      buffer[3] === 0xff
    ) {
      const responseType = buffer[4]

      if (responseType === 0x6c) {
        // 'l' - long response
        return buffer.toString("utf8", 5).trim()
      } else if (responseType === 0x6e) {
        // 'n' - normal response
        return buffer.toString("utf8", 5).trim()
      } else {
        // Try to parse as text after the header
        return buffer.toString("utf8", 4).trim()
      }
    }

    // Fallback for unexpected formats
    this.logger.warn("GoldSrc RCON: Non-standard response format detected")
    return buffer.toString("utf8").trim()
  }

  /**
   * Checks response for known error patterns
   */
  private checkForErrors(response: string, command: string): RconError | null {
    if (response.includes("Bad rcon_password")) {
      this.logger.error("GoldSrc RCON: Authentication failed - bad password")
      return new RconError("Authentication failed", RconErrorCode.AUTH_FAILED)
    }

    if (response.includes("Bad challenge")) {
      this.logger.error("GoldSrc RCON: Bad challenge - need to reconnect")
      return new RconError("Bad challenge", RconErrorCode.AUTH_FAILED)
    }

    if (response.includes("Unknown command")) {
      this.logger.warn(`GoldSrc RCON: Unknown command: ${command}`)
      return new RconError(`Unknown command: ${command}`, RconErrorCode.COMMAND_FAILED)
    }

    return null
  }
}
