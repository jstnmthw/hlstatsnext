/**
 * RCON Repository Implementation
 * 
 * Handles database access for RCON-related operations.
 * Follows the project's repository pattern and database client usage.
 */

import type { DatabaseClient } from "@/database/client"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IRconRepository, RconCredentials, ServerStatus } from "./rcon.types"
import { GameEngine } from "./rcon.types"

export class RconRepository implements IRconRepository {
  constructor(
    private readonly database: DatabaseClient,
    private readonly logger: ILogger,
  ) {}

  async getRconCredentials(serverId: number): Promise<RconCredentials | null> {
    try {
      const server = await this.database.prisma.server.findUnique({
        where: { serverId },
        select: {
          serverId: true,
          address: true,
          port: true,
          rconPassword: true,
          game: true,
        },
      })

      if (!server) {
        this.logger.debug(`Server ${serverId} not found`)
        return null
      }

      if (!server.rconPassword) {
        this.logger.debug(`Server ${serverId} has no RCON password configured`)
        return null
      }

      // Map game string to GameEngine enum
      const gameEngine = this.mapGameToEngine(server.game)

      return {
        serverId: server.serverId,
        address: server.address,
        port: server.port,
        rconPassword: server.rconPassword,
        gameEngine,
      }
    } catch (error) {
      this.logger.error(`Failed to get RCON credentials for server ${serverId}: ${error}`)
      return null
    }
  }

  async updateServerStatus(serverId: number, status: ServerStatus): Promise<void> {
    try {
      // Update server table with current player count
      await this.database.prisma.server.update({
        where: { serverId },
        data: {
          players: status.players,
          maxPlayers: status.maxPlayers,
        },
      })

      // Insert status history record using ServerLoad table
      try {
        await this.database.prisma.serverLoad.create({
          data: {
            serverId,
            timestamp: Math.floor(status.timestamp.getTime() / 1000), // Convert to Unix timestamp
            activePlayers: status.players,
            minPlayers: status.players, // Use current as min for now
            maxPlayers: status.maxPlayers,
            map: status.map,
            uptime: status.uptime.toString(),
            fps: status.fps.toString(),
          },
        })
      } catch (statusError) {
        // ServerLoad insert might fail due to primary key constraints - this is optional
        this.logger.debug(`Could not insert server status history: ${statusError}`)
      }

      this.logger.debug(`Updated status for server ${serverId}`, {
        map: status.map,
        players: status.players,
        maxPlayers: status.maxPlayers,
      })
    } catch (error) {
      this.logger.error(`Failed to update server status for ${serverId}: ${error}`)
      throw error
    }
  }

  private mapGameToEngine(game: string): GameEngine {
    // Map game names to engine types based on common game identifiers
    const lowercaseGame = game.toLowerCase()

    if (lowercaseGame.includes("cstrike") || lowercaseGame.includes("cs_")) {
      // Counter-Strike 1.6 and older
      return GameEngine.GOLDSRC
    }

    if (
      lowercaseGame.includes("css") ||
      lowercaseGame.includes("csgo") ||
      lowercaseGame.includes("cs2") ||
      lowercaseGame.includes("tf") ||
      lowercaseGame.includes("tf2") ||
      lowercaseGame.includes("hl2") ||
      lowercaseGame.includes("source")
    ) {
      // Source engine games
      return GameEngine.SOURCE
    }

    if (
      lowercaseGame.includes("l4d") ||
      lowercaseGame.includes("portal") ||
      lowercaseGame.includes("ep2") ||
      lowercaseGame.includes("dod:s")
    ) {
      // Orange Box era Source engine
      return GameEngine.SOURCE_2009
    }

    // Default to Source for unknown games
    this.logger.warn(`Unknown game type "${game}", defaulting to Source engine`)
    return GameEngine.SOURCE
  }
}