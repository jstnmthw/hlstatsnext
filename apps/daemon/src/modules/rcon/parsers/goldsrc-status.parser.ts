/**
 * GoldSrc Status Response Parser
 *
 * Parses status responses from GoldSrc engine servers (CS 1.6, Half-Life, TFC, etc.)
 * Handles the specific format used by these older engines.
 */

import type { ServerStatus, PlayerInfo } from "../types/rcon.types"
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
   *
   * Player list format:
   * #      name userid uniqueid frag time ping loss adr
   * # 1 "RAGE OF THE BOY" 104 BOT   0  4:27:51    0    0
   * # 2   "Domo" 105 BOT   0  4:27:51    0    0
   * # 5  "d3m0n" 108 STEAM_0:1:470900   0 00:19   10    0
   */
  parseStatus(response: string): ServerStatus {
    const status = this.createDefaultStatus()
    const { statusLines, playerLines } = this.separateResponseSections(response)

    for (const line of statusLines) {
      this.processStatusLine(line, status)
    }

    // Parse player list and update counts
    status.playerList = this.parsePlayerList(playerLines)
    this.updatePlayerCounts(status)

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

  /**
   * Separates the status response into status lines and player lines
   */
  private separateResponseSections(response: string): {
    statusLines: StatusLine[]
    playerLines: string[]
  } {
    const lines = response.split("\n")
    const statusLines: StatusLine[] = []
    const playerLines: string[] = []
    let inPlayerSection = false

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      // Check if this line marks the start of the player list
      if (trimmed.includes("name userid uniqueid frag time ping loss")) {
        inPlayerSection = true
        continue
      }

      if (inPlayerSection) {
        // Player lines start with "#" followed by a number
        if (trimmed.match(/^#\s*\d+/)) {
          playerLines.push(trimmed)
        }
      } else {
        // Process as status line
        const statusLine = this.parseStatusLine(trimmed)
        if (statusLine) {
          statusLines.push(statusLine)
        }
      }
    }

    return { statusLines, playerLines }
  }

  /**
   * Parses player list lines into PlayerInfo objects
   * Format: # 1 "RAGE OF THE BOY" 104 BOT   0  4:27:51    0    0
   * Format: # 5  "d3m0n" 108 STEAM_0:1:470900   0 00:19   10    0
   */
  private parsePlayerList(playerLines: string[]): PlayerInfo[] {
    const players: PlayerInfo[] = []

    for (const line of playerLines) {
      const player = this.parsePlayerLine(line)
      if (player) {
        players.push(player)
      }
    }

    return players
  }

  /**
   * Parses a single player line
   */
  private parsePlayerLine(line: string): PlayerInfo | null {
    // Match pattern: # <slot> "<name>" <userid> <uniqueid> <frag> <time> <ping> <loss> [adr]
    const playerMatch = line.match(
      /^#\s*(\d+)\s+"([^"]+)"\s+(\d+)\s+(\S+)\s+(-?\d+)\s+([\d:]+)\s+(\d+)\s+(\d+)/,
    )

    if (!playerMatch) {
      this.logger.debug("Failed to parse player line", { line })
      return null
    }

    const [, , name, userid, uniqueid, frag, time, ping, loss] = playerMatch

    return {
      name: (name || "").trim(),
      userid: this.parseInt(userid || "0"),
      uniqueid: (uniqueid || "").trim(),
      isBot: uniqueid === "BOT",
      frag: this.parseInt(frag || "0"),
      time: (time || "").trim(),
      ping: this.parseInt(ping || "0"),
      loss: this.parseInt(loss || "0"),
    }
  }

  /**
   * Updates player counts based on parsed player list
   */
  private updatePlayerCounts(status: ServerStatus): void {
    if (!status.playerList) {
      return
    }

    status.realPlayerCount = status.playerList.filter((p) => !p.isBot).length
    status.botCount = status.playerList.filter((p) => p.isBot).length

    this.logger.debug("Player count breakdown", {
      total: status.players,
      realPlayers: status.realPlayerCount,
      bots: status.botCount,
    })
  }
}
