/**
 * RCON Repository Implementation
 *
 * Handles database access for RCON-related operations.
 * Follows the project's repository pattern and database client usage.
 */

import type { DatabaseClient } from "@/database/client"
import type { ILogger } from "@/shared/utils/logger.types"
import type { ICryptoService } from "@repo/crypto"
import type { IRconRepository, RconCredentials, ServerStatus } from "../types/rcon.types"
import { GameEngine } from "../types/rcon.types"

export class RconRepository implements IRconRepository {
  constructor(
    private readonly database: DatabaseClient,
    private readonly logger: ILogger,
    private readonly crypto: ICryptoService,
  ) {}

  async getRconCredentials(serverId: number): Promise<RconCredentials | null> {
    try {
      const server = await this.database.prisma.server.findUnique({
        where: { serverId },
        select: {
          serverId: true,
          address: true,
          rconAddress: true,
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

      // Decrypt the RCON password
      let decryptedPassword: string
      try {
        decryptedPassword = await this.crypto.decrypt(server.rconPassword)
      } catch (error) {
        this.logger.error(`Failed to decrypt RCON password for server ${serverId}: ${error}`)
        return null
      }

      // An explicit rconAddress takes precedence over the beacon-learned address.
      // The learned address is the UDP source IP, which is unusable when it has
      // been NAT'd (e.g. a Docker bridge gateway); rconAddress lets an operator
      // pin the real RCON host (IP or resolvable hostname / container alias).
      const rconAddress = server.rconAddress || server.address
      this.logger.debug(`RCON connection for server ${serverId}: ${rconAddress}:${server.port}`)

      return {
        serverId: server.serverId,
        address: rconAddress,
        port: server.port,
        rconPassword: decryptedPassword,
        gameEngine,
      }
    } catch (error) {
      this.logger.error(`Failed to get RCON credentials for server ${serverId}: ${error}`)
      return null
    }
  }

  async recordServerLoad(serverId: number, status: ServerStatus): Promise<void> {
    try {
      // Insert status history record using ServerLoad table
      await this.database.prisma.serverLoad.create({
        data: {
          serverId,
          timestamp: Math.floor(status.timestamp.getTime() / 1000), // Convert to Unix timestamp
          activePlayers: status.realPlayerCount ?? status.players,
          minPlayers: status.realPlayerCount ?? status.players, // Use current as min for now
          maxPlayers: status.maxPlayers,
          map: status.map,
          uptime: status.uptime.toString(),
          fps: status.fps.toString(),
        },
      })

      this.logger.debug(`Recorded server load history for server ${serverId}`, {
        map: status.map,
        realPlayers: status.realPlayerCount,
        totalPlayers: status.players,
        maxPlayers: status.maxPlayers,
      })
    } catch (error) {
      // ServerLoad insert might fail due to primary key constraints - this is optional
      this.logger.debug(`Could not insert server status history: ${error}`)
    }
  }

  async pruneServerLoad(olderThanUnixSeconds: number): Promise<number> {
    try {
      const result = await this.database.prisma.serverLoad.deleteMany({
        where: { timestamp: { lt: olderThanUnixSeconds } },
      })
      return result.count
    } catch (error) {
      this.logger.warn(`Failed to prune servers_load history: ${error}`)
      return 0
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
