/**
 * Status Command Handler
 *
 * Implements the "status" RCON command to retrieve server information.
 */

import { BaseRconCommand } from "./command.types"
import type { ServerStatus } from "../types/rcon.types"

export class StatusCommand extends BaseRconCommand<ServerStatus> {
  constructor() {
    super("status")
  }

  parse(response: string): ServerStatus {
    const lines = response.split("\n").map((line) => line.trim())

    // Initialize with default values
    const status: ServerStatus = {
      map: "unknown",
      players: 0,
      maxPlayers: 0,
      uptime: 0,
      fps: 0,
      timestamp: new Date(),
    }

    for (const line of lines) {
      if (!line) continue

      // Parse different status response formats
      this.parseMapInfo(line, status)
      this.parsePlayerInfo(line, status)
      this.parseServerInfo(line, status)
      this.parsePerformanceInfo(line, status)
    }

    return status
  }

  private parseMapInfo(line: string, status: ServerStatus): void {
    // Map info patterns:
    // "map: de_dust2"
    // "level name: de_dust2"
    const mapMatch = line.match(/(?:map|level name)\s*:\s*(.+)/i)
    if (mapMatch && mapMatch[1]) {
      status.map = mapMatch[1].trim()
      return
    }

    // Alternative format: "Current map: de_dust2"
    const currentMapMatch = line.match(/current map\s*:\s*(.+)/i)
    if (currentMapMatch && currentMapMatch[1]) {
      status.map = currentMapMatch[1].trim()
    }
  }

  private parsePlayerInfo(line: string, status: ServerStatus): void {
    // Player count patterns:
    // "players : 12 (16 max)"
    // "players: 12/16"
    // "# users: 12 max: 16"

    const playersMatch = line.match(/players?\s*:\s*(\d+)\s*(?:\((\d+)\s*max\)|\/(\d+))/i)
    if (playersMatch && playersMatch[1]) {
      status.players = parseInt(playersMatch[1], 10)
      const maxPlayers = playersMatch[2] || playersMatch[3]
      if (maxPlayers) {
        status.maxPlayers = parseInt(maxPlayers, 10)
      }
      return
    }

    const usersMatch = line.match(/#?\s*users?\s*:\s*(\d+).*?max\s*:\s*(\d+)/i)
    if (usersMatch && usersMatch[1] && usersMatch[2]) {
      status.players = parseInt(usersMatch[1], 10)
      status.maxPlayers = parseInt(usersMatch[2], 10)
    }
  }

  private parseServerInfo(line: string, status: ServerStatus): void {
    // Hostname patterns:
    // "hostname: My Server Name"
    const hostnameMatch = line.match(/hostname\s*:\s*(.+)/i)
    if (hostnameMatch && hostnameMatch[1]) {
      status.hostname = hostnameMatch[1].trim()
      return
    }

    // Version patterns:
    // "version: 1.37.1.1/Stdio (cstrike)"
    // "protocol version 48 exe build 8684"
    const versionMatch = line.match(/version\s*:\s*(.+)/i)
    if (versionMatch && versionMatch[1]) {
      status.version = versionMatch[1].trim()
      return
    }

    const protocolMatch = line.match(/protocol version\s+(\d+).*?exe build\s+(\d+)/i)
    if (protocolMatch && protocolMatch[1] && protocolMatch[2]) {
      status.version = `Protocol ${protocolMatch[1]} Build ${protocolMatch[2]}`
    }
  }

  private parsePerformanceInfo(line: string, status: ServerStatus): void {
    // FPS patterns:
    // "fps: 128.5"
    // "server fps: 100.0"
    const fpsMatch = line.match(/(?:server\s+)?fps\s*:\s*([\d.]+)/i)
    if (fpsMatch && fpsMatch[1]) {
      status.fps = parseFloat(fpsMatch[1])
      return
    }

    // Uptime patterns:
    // "uptime: 1234 sec"
    // "server uptime: 12:34:56"
    const uptimeSecMatch = line.match(/uptime\s*:\s*(\d+)\s*sec/i)
    if (uptimeSecMatch && uptimeSecMatch[1]) {
      status.uptime = parseInt(uptimeSecMatch[1], 10)
      return
    }

    const uptimeTimeMatch = line.match(/(?:server\s+)?uptime\s*:\s*(\d+):(\d+):(\d+)/i)
    if (uptimeTimeMatch && uptimeTimeMatch[1] && uptimeTimeMatch[2] && uptimeTimeMatch[3]) {
      const hours = parseInt(uptimeTimeMatch[1], 10)
      const minutes = parseInt(uptimeTimeMatch[2], 10)
      const seconds = parseInt(uptimeTimeMatch[3], 10)
      status.uptime = hours * 3600 + minutes * 60 + seconds
    }
  }
}
