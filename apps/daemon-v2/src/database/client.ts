/**
 * Database Client for HLStats Daemon v2
 *
 * Provides a centralized database client with connection management,
 * error handling, and transaction support for the daemon services.
 */

import { db, Player, type PrismaClient } from "@repo/database/client"
import type {
  GameEvent,
  PlayerConnectEvent,
  PlayerDisconnectEvent,
  PlayerKillEvent,
  PlayerChatEvent,
  PlayerSuicideEvent,
  PlayerTeamkillEvent,
} from "@/types/common/events"

export class DatabaseClient {
  private client: PrismaClient

  constructor() {
    this.client = db
  }

  /**
   * Get the Prisma client instance
   */
  get prisma(): PrismaClient {
    return this.client
  }

  /**
   * Test database connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`
      return true
    } catch (error) {
      console.error("Database connection test failed:", error)
      return false
    }
  }

  /**
   * Create a new game event record
   */
  async createGameEvent(event: GameEvent): Promise<void> {
    try {
      // Map our event types to legacy HLStatsX event tables
      switch (event.eventType) {
        case "PLAYER_CONNECT":
          await this.createConnectEvent(event)
          break
        case "PLAYER_DISCONNECT":
          await this.createDisconnectEvent(event)
          break
        case "PLAYER_KILL":
          await this.createFragEvent(event)
          break
        case "PLAYER_SUICIDE":
          await this.createSuicideEvent(event)
          break
        case "PLAYER_TEAMKILL":
          await this.createTeamkillEvent(event)
          break
        case "CHAT_MESSAGE":
          await this.createChatEvent(event)
          break
        default:
          console.warn(`Unhandled event type: ${event.eventType}`)
      }
    } catch (error) {
      console.error(`Failed to create game event:`, error)
      throw error
    }
  }

  private async createConnectEvent(event: PlayerConnectEvent): Promise<void> {
    await this.client.eventConnect.create({
      data: {
        eventTime: event.timestamp,
        playerId: event.data.playerId,
        ipAddress: event.data.ipAddress || "",
        hostname: event.data.playerName || "",
        serverId: event.serverId,
        map: "", // Will be populated when we have map tracking
      },
    })
  }

  private async createDisconnectEvent(event: PlayerDisconnectEvent): Promise<void> {
    await this.client.eventDisconnect.create({
      data: {
        eventTime: event.timestamp,
        playerId: event.data.playerId,
        serverId: event.serverId,
        map: "", // Will be populated when we have map tracking
      },
    })
  }

  private async createFragEvent(event: PlayerKillEvent): Promise<void> {
    await this.client.eventFrag.create({
      data: {
        eventTime: event.timestamp,
        killerId: event.data.killerId,
        victimId: event.data.victimId,
        weapon: event.data.weapon,
        headshot: event.data.headshot ? 1 : 0,
        serverId: event.serverId,
        map: "", // Will be populated when we have map tracking
        pos_x: event.data.killerPosition?.x || 0,
        pos_y: event.data.killerPosition?.y || 0,
        pos_z: event.data.killerPosition?.z || 0,
        pos_victim_x: event.data.victimPosition?.x || 0,
        pos_victim_y: event.data.victimPosition?.y || 0,
        pos_victim_z: event.data.victimPosition?.z || 0,
      },
    })
  }

  private async createSuicideEvent(event: PlayerSuicideEvent): Promise<void> {
    await this.client.eventSuicide.create({
      data: {
        eventTime: event.timestamp,
        playerId: event.data.playerId,
        weapon: event.data.weapon || "world",
        serverId: event.serverId,
        map: "", // Will be populated when we have map tracking
        pos_x: event.data.position?.x || 0,
        pos_y: event.data.position?.y || 0,
        pos_z: event.data.position?.z || 0,
      },
    })
  }

  private async createTeamkillEvent(event: PlayerTeamkillEvent): Promise<void> {
    await this.client.eventTeamkill.create({
      data: {
        eventTime: event.timestamp,
        killerId: event.data.killerId,
        victimId: event.data.victimId,
        weapon: event.data.weapon,
        serverId: event.serverId,
        map: "", // Will be populated when we have map tracking
        pos_x: event.data.killerPosition?.x || 0,
        pos_y: event.data.killerPosition?.y || 0,
        pos_z: event.data.killerPosition?.z || 0,
        pos_victim_x: event.data.victimPosition?.x || 0,
        pos_victim_y: event.data.victimPosition?.y || 0,
        pos_victim_z: event.data.victimPosition?.z || 0,
      },
    })
  }

  private async createChatEvent(event: PlayerChatEvent): Promise<void> {
    await this.client.eventChat.create({
      data: {
        eventTime: event.timestamp,
        playerId: event.data.playerId,
        serverId: event.serverId,
        map: "", // Placeholder until map tracking implemented
        message_mode: event.data.isDead ? 1 : 0,
        message: event.data.message.substring(0, 128),
      },
    })
  }

  /**
   * Get or create a player by Steam ID
   */
  async getOrCreatePlayer(steamId: string, playerName: string, game: string): Promise<number> {
    const isBot = steamId.toUpperCase() === "BOT"
    const normalizedName = playerName
      .trim()
      .replace(/\s+/g, "_") // Spaces → underscores
      .replace(/[^A-Za-z0-9_-]/g, "") // Remove exotic chars
      .substring(0, 48) // Leave room for "BOT_" prefix within 64-char limit

    const effectiveId = isBot ? `BOT_${normalizedName}` : steamId

    try {
      // First, try to find existing player by Steam ID
      const uniqueId = await this.client.playerUniqueId.findUnique({
        where: {
          uniqueId_game: {
            uniqueId: effectiveId,
            game: game,
          },
        },
        include: {
          player: true,
        },
      })

      if (uniqueId) {
        return uniqueId.playerId
      }

      // Create new player
      const player = await this.client.player.create({
        data: {
          lastName: playerName,
          game: game,
          skill: 1000, // Default skill rating
          uniqueIds: {
            create: {
              uniqueId: effectiveId,
              game: game,
            },
          },
        },
      })

      return player.playerId
    } catch (error) {
      console.error(`Failed to get or create player:`, error)
      throw error
    }
  }

  /**
   * Update player statistics
   */
  async updatePlayerStats(
    playerId: number,
    updates: {
      kills?: number
      deaths?: number
      suicides?: number
      teamkills?: number
      skill?: number
      shots?: number
      hits?: number
      headshots?: number
      kill_streak?: number
      death_streak?: number
      connection_time?: number
    },
  ): Promise<void> {
    try {
      const updateData: Record<string, unknown> = {}

      if (updates.kills !== undefined) {
        updateData.kills = { increment: updates.kills }
      }
      if (updates.deaths !== undefined) {
        updateData.deaths = { increment: updates.deaths }
      }
      if (updates.suicides !== undefined) {
        updateData.suicides = { increment: updates.suicides }
      }
      if (updates.teamkills !== undefined) {
        updateData.teamkills = { increment: updates.teamkills }
      }
      if (updates.skill !== undefined) {
        updateData.skill = updates.skill
      }
      if (updates.shots !== undefined) {
        updateData.shots = { increment: updates.shots }
      }
      if (updates.hits !== undefined) {
        updateData.hits = { increment: updates.hits }
      }
      if (updates.headshots !== undefined) {
        updateData.headshots = { increment: updates.headshots }
      }
      if (updates.kill_streak !== undefined) {
        updateData.kill_streak = updates.kill_streak
      }
      if (updates.death_streak !== undefined) {
        updateData.death_streak = updates.death_streak
      }
      if (updates.connection_time !== undefined) {
        updateData.connection_time = { increment: updates.connection_time }
      }

      await this.client.player.update({
        where: { playerId },
        data: updateData,
      })
    } catch (error) {
      console.error(`Failed to update player stats:`, error)
      throw error
    }
  }

  /**
   * Get player statistics
   */
  async getPlayerStats(playerId: number): Promise<Player | null> {
    try {
      const player = await this.client.player.findUnique({
        where: { playerId },
      })

      return player
    } catch (error) {
      console.error(`Failed to get player stats:`, error)
      throw error
    }
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(
    callback: (
      tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
    ) => Promise<T>,
  ): Promise<T> {
    return this.client.$transaction(callback)
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    await this.client.$disconnect()
  }

  /**
   * Look up a game server by its IP address and port. This is used by the ingress
   * service to authenticate that incoming UDP packets originate from a known and
   * authorised server record that an admin has added via the (future) admin UI.
   */
  async getServerByAddress(ipAddress: string, port: number): Promise<{ serverId: number } | null> {
    try {
      const server = await this.client.server.findFirst({
        where: {
          address: ipAddress,
          port,
        },
        select: {
          serverId: true,
        },
      })

      return server ?? null
    } catch (error) {
      console.error(`Failed to fetch server by address:`, error)
      throw error
    }
  }

  /**
   * Get top players by skill ranking
   * @param limit Number of players to return (default 50)
   * @param game Game code to filter by
   * @param includeHidden Whether to include players with hideranking set
   */
  async getTopPlayers(limit: number = 50, game: string = "cstrike", includeHidden: boolean = false): Promise<Player[]> {
    try {
      const whereClause: Record<string, unknown> = {
        game,
      }

      if (!includeHidden) {
        whereClause.hideranking = 0
      }

      const players = await this.client.player.findMany({
        where: whereClause,
        orderBy: {
          skill: "desc",
        },
        take: Math.min(limit, 100), // Cap at 100 for safety
      })

      return players
    } catch (error) {
      console.error(`Failed to get top players:`, error)
      throw error
    }
  }
}
