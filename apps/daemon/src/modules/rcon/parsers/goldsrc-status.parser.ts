/**
 * GoldSrc Status Response Parser
 *
 * Parses status responses from GoldSrc engine servers (CS 1.6, Half-Life, TFC, etc.)
 * Handles the specific format used by these older engines.
 */

import type { ServerStatus } from "../rcon.types"
import type { ILogger } from "@/shared/utils/logger.types"
import { BaseStatusParser, type StatusLine } from "./base-status.parser"

/**
 * Parser for GoldSrc engine status responses
 */
export class GoldSrcStatusParser extends BaseStatusParser {
  constructor(logger: ILogger) {
    super(logger)
  }

  /**
   * Parses GoldSrc status response format:
   * hostname:  [DEV] CS1.6 Test Server
   * version :  48/1.1.2.7/Stdio 10211 secure  (10)
   * tcp/ip  :  0.0.0.0:27015
   * map     :  de_cbble at: 0 x, 0 y, 0 z
   * players :  30 active (32 max)
   */
  parseStatus(response: string): ServerStatus {
    const status = this.createDefaultStatus()
    const statusLines = this.extractStatusLines(response)

    for (const line of statusLines) {
      this.processStatusLine(line, status)
    }

    this.logParsingResult(status)
    return status
  }

  /**
   * Processes individual status line based on GoldSrc format
   */
  private processStatusLine(line: StatusLine, status: ServerStatus): void {
    switch (line.key) {
      case "hostname":
        status.hostname = line.value
        break

      case "version":
        status.version = line.value
        break

      case "map":
        this.parseMapInfo(line.value, status)
        break

      case "players":
        this.parsePlayerInfo(line.value, status)
        break

      case "fps":
        this.parseFpsInfo(line.value, status)
        break

      case "cpu":
        this.parseCpuInfo(line.value, status)
        break
    }
  }

  /**
   * Parses map information from formats like:
   * "de_cbble at: 0 x, 0 y, 0 z" or "de_cbble"
   */
  private parseMapInfo(value: string, status: ServerStatus): void {
    const mapMatch = value.match(/^(\S+)/)
    if (mapMatch && mapMatch[1]) {
      status.map = mapMatch[1]
    }
  }

  /**
   * Parses player information from formats like:
   * "30 active (32 max)" or "30 (32 max)" or "30/32"
   */
  private parsePlayerInfo(value: string, status: ServerStatus): void {
    // Try format: "30 active (32 max)" or "30 (32 max)"
    const playerMatch = value.match(/(\d+)\s*(?:active)?\s*\((\d+)\s*max\)/)
    if (playerMatch && playerMatch[1] && playerMatch[2]) {
      status.players = this.parseInt(playerMatch[1])
      status.maxPlayers = this.parseInt(playerMatch[2])
      return
    }

    // Try simpler format: "30/32"
    const simpleMatch = value.match(/(\d+)\/(\d+)/)
    if (simpleMatch && simpleMatch[1] && simpleMatch[2]) {
      status.players = this.parseInt(simpleMatch[1])
      status.maxPlayers = this.parseInt(simpleMatch[2])
    }
  }

  /**
   * Parses FPS information from value
   */
  private parseFpsInfo(value: string, status: ServerStatus): void {
    const fpsMatch = value.match(/[\d.]+/)
    if (fpsMatch && fpsMatch[0]) {
      status.fps = this.parseFloat(fpsMatch[0])
    }
  }

  /**
   * Parses CPU information from value
   */
  private parseCpuInfo(value: string, status: ServerStatus): void {
    const cpuMatch = value.match(/[\d.]+/)
    if (cpuMatch && cpuMatch[0]) {
      status.cpu = this.parseFloat(cpuMatch[0])
    }
  }
}
