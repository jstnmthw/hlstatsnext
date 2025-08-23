/**
 * Server Status Enricher
 *
 * Enriches server data by fetching real-time status via RCON.
 * Updates server information that can be queried directly from the game server.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import type { IRconService, ServerStatus } from "@/modules/rcon/rcon.types"
import type {
  IServerRepository,
  IServerService,
  ServerStatusUpdate,
} from "@/modules/server/server.types"

export interface IServerStatusEnricher {
  /**
   * Enrich server status data via RCON
   */
  enrichServerStatus(serverId: number): Promise<void>
}

/**
 * Enriches server status using RCON data
 */
export class ServerStatusEnricher implements IServerStatusEnricher {
  constructor(
    private readonly rconService: IRconService,
    private readonly serverRepository: IServerRepository,
    private readonly serverService: IServerService,
    private readonly logger: ILogger,
  ) {}

  /**
   * Enriches server status by querying RCON and updating database
   */
  async enrichServerStatus(serverId: number): Promise<void> {
    try {
      const status = await this.fetchServerStatus(serverId)
      const update = await this.buildStatusUpdate(serverId, status)
      await this.updateServerDatabase(serverId, update, status.map)

      this.logger.debug(`Enriched server ${serverId} status`, {
        players: `${update.activePlayers}/${update.maxPlayers}`,
        map: update.activeMap,
        hostname: update.hostname,
      })
    } catch (error) {
      this.logger.warn(`Failed to enrich server ${serverId} status: ${error}`)
    }
  }

  /**
   * Fetches server status via RCON
   */
  private async fetchServerStatus(serverId: number): Promise<ServerStatus> {
    if (!this.rconService.isConnected(serverId)) {
      await this.rconService.connect(serverId)
    }

    return await this.rconService.getStatus(serverId)
  }

  /**
   * Builds server status update from RCON data, respecting IgnoreBots config
   */
  private async buildStatusUpdate(
    serverId: number,
    status: ServerStatus,
  ): Promise<ServerStatusUpdate> {
    // Get IgnoreBots configuration (default to false - include bots)
    const ignoreBots = await this.serverService.getServerConfigBoolean(
      serverId,
      "IgnoreBots",
      false,
    )

    // Calculate active players based on IgnoreBots setting
    let activePlayers: number
    if (ignoreBots) {
      // Only count real players, exclude bots
      activePlayers = status.realPlayerCount ?? status.players
    } else {
      // Count all players (real + bots)
      activePlayers = status.players
    }

    // Log player breakdown for debugging
    if (status.realPlayerCount !== undefined && status.botCount !== undefined) {
      const ignoreBotStatus = ignoreBots ? " (IgnoreBots=ON)" : " (IgnoreBots=OFF)"
      this.logger.ok(
        `Players: ${status.realPlayerCount} real + ${status.botCount} bots = ${status.players} total${ignoreBotStatus} on server ${serverId}`,
      )
    }

    return {
      activePlayers,
      maxPlayers: status.maxPlayers,
      activeMap: status.map,
      hostname: status.hostname,
    }
  }

  /**
   * Updates server database with enriched status
   */
  private async updateServerDatabase(
    serverId: number,
    update: ServerStatusUpdate,
    newMap: string,
  ): Promise<void> {
    // Check if map changed to potentially reset map stats
    const currentMap = await this.getCurrentMap(serverId)
    const mapChanged = currentMap && currentMap !== newMap

    if (mapChanged) {
      await this.handleMapChange(serverId, newMap, update.activePlayers)
      this.logger.ok(
        `Map changed for server ${serverId}: ${currentMap} → ${newMap} (${update.activePlayers} players)`,
      )
    } else {
      await this.serverRepository.updateServerStatusFromRcon(serverId, update)
      this.logger.ok(
        `Updated server ${serverId}: ${update.activePlayers}/${update.maxPlayers} players on ${update.activeMap}`,
      )
    }
  }

  /**
   * Gets the current map for a server
   */
  private async getCurrentMap(serverId: number): Promise<string | null> {
    const server = await this.serverRepository.findById(serverId)
    return server?.activeMap || null
  }

  /**
   * Handles map change by resetting map statistics
   */
  private async handleMapChange(
    serverId: number,
    newMap: string,
    playerCount: number,
  ): Promise<void> {
    this.logger.info(`Map changed for server ${serverId} to ${newMap}`)

    // Reset map stats with new map and current player count
    await this.serverRepository.resetMapStats(serverId, newMap, playerCount)
  }
}
