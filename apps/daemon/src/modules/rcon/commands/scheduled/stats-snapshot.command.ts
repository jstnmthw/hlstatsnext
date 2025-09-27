/**
 * Stats Snapshot Command
 *
 * Captures server statistics and status information on a scheduled basis.
 * Processes and stores server status data for monitoring and analysis.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import type { IRconService, ServerStatus } from "../../types/rcon.types"
import type {
  ScheduledCommand,
  ScheduleExecutionContext,
  ScheduleExecutionResult,
} from "../../types/schedule.types"
import { BaseScheduledCommand } from "./base-scheduled.command"

/**
 * Interface for processed stats data
 */
interface StatsSnapshot {
  serverId: number
  serverName: string
  timestamp: Date
  status: ServerStatus
  playerCount: number
  botCount: number
  realPlayerCount: number
  mapName: string
  uptime: number
  fps: number
  rawResponse: string
  metadata: {
    scheduleId: string
    executionTimeMs: number
    category: string
  }
}

/**
 * Stats snapshot command executor for monitoring and data collection
 */
export class StatsSnapshotCommand extends BaseScheduledCommand {
  constructor(logger: ILogger, rconService: IRconService) {
    super(logger, rconService)
  }

  /**
   * Get command type identifier
   */
  getType(): string {
    return "stats-snapshot"
  }

  /**
   * Validate that the command is a stats/status command
   */
  protected async validateCommand(schedule: ScheduledCommand): Promise<boolean> {
    const command = typeof schedule.command === "string" ? schedule.command : ""

    // Check if it's a valid stats/status command
    const validStatsCommands = ["status", "stats", "info", "fps_max", "players"]
    const isValidCommand = validStatsCommands.some(
      (cmd) => command.toLowerCase().startsWith(cmd) || command.toLowerCase() === cmd,
    )

    if (!isValidCommand) {
      this.logger.warn(`Invalid stats command for schedule ${schedule.id}: ${command}`)
      return false
    }

    // Check if the schedule has proper metadata for stats capture
    if (schedule.metadata?.captureStats && !schedule.metadata.category) {
      this.logger.warn(`Stats capture schedule ${schedule.id} missing category metadata`)
      return false
    }

    return true
  }

  /**
   * Process the stats response and extract meaningful data
   */
  protected async processResponse(
    response: string,
    context: ScheduleExecutionContext,
  ): Promise<string> {
    const { schedule, server } = context

    try {
      // Parse the server status from the response
      const serverStatus = await this.parseServerStatus(response, server.serverId)

      // Create stats snapshot
      const snapshot: StatsSnapshot = {
        serverId: server.serverId,
        serverName: server.name,
        timestamp: new Date(),
        status: serverStatus,
        playerCount: serverStatus.players,
        botCount: serverStatus.botCount || 0,
        realPlayerCount: serverStatus.realPlayerCount || serverStatus.players,
        mapName: serverStatus.map,
        uptime: serverStatus.uptime,
        fps: serverStatus.fps,
        rawResponse: response,
        metadata: {
          scheduleId: schedule.id,
          executionTimeMs: 0, // Will be set later
          category: (schedule.metadata?.category as string) || "monitoring",
        },
      }

      // Process the snapshot based on schedule configuration
      await this.processStatsSnapshot(snapshot, context)

      return this.formatStatsResponse(snapshot)
    } catch (error) {
      this.logger.error(`Failed to process stats response for schedule ${schedule.id}`, {
        scheduleId: schedule.id,
        serverId: server.serverId,
        error: error instanceof Error ? error.message : String(error),
        responseLength: response.length,
      })

      // Return original response if processing fails
      return response
    }
  }

  /**
   * Called after successful stats execution
   */
  protected async onExecutionSuccess(
    result: ScheduleExecutionResult,
    context: ScheduleExecutionContext,
  ): Promise<void> {
    const { schedule, server } = context

    // Update execution time in metadata
    const executionTimeMs = result.executionTimeMs

    this.logger.info(`Stats snapshot captured successfully`, {
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      serverId: server.serverId,
      serverName: server.name,
      executionTimeMs,
      category: schedule.metadata?.category,
      responseSize: result.response?.length || 0,
    })

    // Handle special processing based on metadata
    if (schedule.metadata?.logToFile) {
      await this.logSnapshotToFile(context)
    }

    if (schedule.metadata?.sendToMonitoring) {
      await this.sendToMonitoringSystem(context)
    }
  }

  /**
   * Parse server status from RCON response
   */
  private async parseServerStatus(response: string, serverId: number): Promise<ServerStatus> {
    try {
      // Use the existing RCON service's status parsing if available
      // For now, we'll do basic parsing
      return this.parseBasicServerStatus(response)
    } catch (error) {
      this.logger.warn(`Failed to parse server status for server ${serverId}: ${error}`)

      // Return minimal status if parsing fails
      return {
        map: "unknown",
        players: 0,
        maxPlayers: 0,
        uptime: 0,
        fps: 0,
        timestamp: new Date(),
      }
    }
  }

  /**
   * Basic server status parsing from response text
   */
  private parseBasicServerStatus(response: string): ServerStatus {
    const status: ServerStatus = {
      map: "unknown",
      players: 0,
      maxPlayers: 0,
      uptime: 0,
      fps: 0,
      timestamp: new Date(),
    }

    try {
      // Parse different response formats
      if (response.includes("hostname:")) {
        // GoldSrc format
        status.hostname = this.extractValue(response, /hostname:\s*(.+)/i)
        status.version = this.extractValue(response, /version\s*:\s*(.+)/i)
        status.map = this.extractValue(response, /map\s*:\s*(\w+)/i) || "unknown"

        const playersMatch = response.match(/players\s*:\s*(\d+)\s*\(\s*(\d+)\s*max\)/i)
        if (playersMatch && playersMatch[1] && playersMatch[2]) {
          status.players = parseInt(playersMatch[1], 10)
          status.maxPlayers = parseInt(playersMatch[2], 10)
        }

        const uptimeMatch = response.match(/uptime\s*:\s*(\d+):(\d+):(\d+)/i)
        if (uptimeMatch && uptimeMatch[1] && uptimeMatch[2] && uptimeMatch[3]) {
          const hours = parseInt(uptimeMatch[1], 10)
          const minutes = parseInt(uptimeMatch[2], 10)
          const seconds = parseInt(uptimeMatch[3], 10)
          status.uptime = hours * 3600 + minutes * 60 + seconds
        }

        const fpsMatch = response.match(/fps\s*:\s*(\d+(?:\.\d+)?)/i)
        if (fpsMatch && fpsMatch[1]) {
          status.fps = parseFloat(fpsMatch[1])
        }

        // Count real players vs bots
        const playerLines = response
          .split("\n")
          .filter(
            (line) => line.includes("#") && line.includes('"') && !line.includes("STEAM_ID_LAN"),
          )

        status.realPlayerCount = playerLines.filter((line) => !line.includes("BOT")).length
        status.botCount = playerLines.filter((line) => line.includes("BOT")).length
      } else if (response.includes("Server Name:")) {
        // Source format
        status.hostname = this.extractValue(response, /Server Name:\s*(.+)/i)
        status.map = this.extractValue(response, /Map:\s*(\w+)/i) || "unknown"

        const playersMatch = response.match(/Players:\s*(\d+)\/(\d+)/i)
        if (playersMatch && playersMatch[1] && playersMatch[2]) {
          status.players = parseInt(playersMatch[1], 10)
          status.maxPlayers = parseInt(playersMatch[2], 10)
        }
      }

      // Extract player list if present
      if (response.includes("# userid name") || response.includes("#  name")) {
        // TODO: Parse full PlayerInfo with all required fields
        // status.playerList = this.parsePlayerList(response)
      }
    } catch (error) {
      this.logger.debug(`Error parsing server status details: ${error}`)
    }

    return status
  }

  /**
   * Extract value using regex from response
   */
  private extractValue(response: string, regex: RegExp): string | undefined {
    const match = response.match(regex)
    return match?.[1]?.trim()
  }

  /**
   * Process the stats snapshot based on configuration
   */
  private async processStatsSnapshot(
    snapshot: StatsSnapshot,
    context: ScheduleExecutionContext,
  ): Promise<void> {
    const { schedule } = context

    // Add execution time
    snapshot.metadata.executionTimeMs = Date.now() - snapshot.timestamp.getTime()

    // Validate data quality
    if (snapshot.playerCount < 0 || snapshot.fps < 0) {
      this.logger.warn(`Invalid stats data captured for server ${snapshot.serverId}`, {
        playerCount: snapshot.playerCount,
        fps: snapshot.fps,
        scheduleId: schedule.id,
      })
    }

    // Check for anomalies
    if (snapshot.fps > 0 && snapshot.fps < 30) {
      this.logger.warn(`Low FPS detected on server ${snapshot.serverId}: ${snapshot.fps}`, {
        serverId: snapshot.serverId,
        serverName: snapshot.serverName,
        fps: snapshot.fps,
        scheduleId: schedule.id,
      })
    }

    // Store snapshot if configured
    if (schedule.metadata?.persistSnapshot) {
      await this.persistSnapshot(snapshot)
    }
  }

  /**
   * Format stats response for result
   */
  private formatStatsResponse(snapshot: StatsSnapshot): string {
    return [
      `Stats captured for ${snapshot.serverName}`,
      `Players: ${snapshot.realPlayerCount}/${snapshot.status.maxPlayers} (${snapshot.botCount} bots)`,
      `Map: ${snapshot.mapName}`,
      `FPS: ${snapshot.fps}`,
      `Uptime: ${this.formatUptime(snapshot.uptime)}`,
    ].join(" | ")
  }

  /**
   * Format uptime in human-readable format
   */
  private formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  /**
   * Log snapshot to file if configured
   */
  private async logSnapshotToFile(context: ScheduleExecutionContext): Promise<void> {
    // This would implement file logging
    // For now, just log the intention
    this.logger.debug(`Would log snapshot to file for schedule ${context.schedule.id}`)
  }

  /**
   * Send snapshot to monitoring system if configured
   */
  private async sendToMonitoringSystem(context: ScheduleExecutionContext): Promise<void> {
    // This would implement sending to monitoring/metrics system
    // For now, just log the intention
    this.logger.debug(
      `Would send snapshot to monitoring system for schedule ${context.schedule.id}`,
    )
  }

  /**
   * Persist snapshot to database or storage
   */
  private async persistSnapshot(snapshot: StatsSnapshot): Promise<void> {
    // This would implement database storage
    // For now, just log the intention
    this.logger.debug(`Would persist snapshot for server ${snapshot.serverId}`)
  }
}
