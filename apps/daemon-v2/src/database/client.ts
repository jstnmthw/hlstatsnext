/**
 * Database Client for HLStats Daemon v2
 *
 * Provides a centralized database client with connection management,
 * error handling, and transaction support for the daemon services.
 */

import { db, Player, type PrismaClient } from "@repo/database/client";
import type {
  GameEvent,
  PlayerConnectEvent,
  PlayerDisconnectEvent,
  PlayerKillEvent,
} from "../types/common/events.types.js";

export class DatabaseClient {
  private client: PrismaClient;

  constructor() {
    this.client = db;
  }

  /**
   * Get the Prisma client instance
   */
  get prisma(): PrismaClient {
    return this.client;
  }

  /**
   * Test database connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error("Database connection test failed:", error);
      return false;
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
          await this.createConnectEvent(event);
          break;
        case "PLAYER_DISCONNECT":
          await this.createDisconnectEvent(event);
          break;
        case "PLAYER_KILL":
          await this.createFragEvent(event);
          break;
        default:
          console.warn(`Unhandled event type: ${event.eventType}`);
      }
    } catch (error) {
      console.error(`Failed to create game event:`, error);
      throw error;
    }
  }

  private async createConnectEvent(event: GameEvent): Promise<void> {
    const connectEvent = event as PlayerConnectEvent;
    if (connectEvent.eventType !== "PLAYER_CONNECT") return;

    await this.client.eventConnect.create({
      data: {
        eventTime: event.timestamp,
        playerId: connectEvent.data.playerId,
        ipAddress: connectEvent.data.ipAddress || "",
        hostname: connectEvent.data.playerName || "",
        serverId: event.serverId,
        map: "", // Will be populated when we have map tracking
      },
    });
  }

  private async createDisconnectEvent(event: GameEvent): Promise<void> {
    const disconnectEvent = event as PlayerDisconnectEvent;
    if (disconnectEvent.eventType !== "PLAYER_DISCONNECT") return;

    await this.client.eventDisconnect.create({
      data: {
        eventTime: event.timestamp,
        playerId: disconnectEvent.data.playerId,
        serverId: event.serverId,
        map: "", // Will be populated when we have map tracking
      },
    });
  }

  private async createFragEvent(event: GameEvent): Promise<void> {
    const killEvent = event as PlayerKillEvent;
    if (killEvent.eventType !== "PLAYER_KILL") return;

    await this.client.eventFrag.create({
      data: {
        eventTime: event.timestamp,
        killerId: killEvent.data.killerId,
        victimId: killEvent.data.victimId,
        weapon: killEvent.data.weapon,
        headshot: killEvent.data.headshot ? 1 : 0,
        serverId: event.serverId,
        map: "", // Will be populated when we have map tracking
        pos_x: killEvent.data.killerPosition?.x || 0,
        pos_y: killEvent.data.killerPosition?.y || 0,
        pos_z: killEvent.data.killerPosition?.z || 0,
        pos_victim_x: killEvent.data.victimPosition?.x || 0,
        pos_victim_y: killEvent.data.victimPosition?.y || 0,
        pos_victim_z: killEvent.data.victimPosition?.z || 0,
      },
    });
  }

  /**
   * Get or create a player by Steam ID
   */
  async getOrCreatePlayer(
    steamId: string,
    playerName: string,
    game: string
  ): Promise<number> {
    try {
      // First, try to find existing player by Steam ID
      const uniqueId = await this.client.playerUniqueId.findUnique({
        where: {
          uniqueId_game: {
            uniqueId: steamId,
            game: game,
          },
        },
        include: {
          player: true,
        },
      });

      if (uniqueId) {
        return uniqueId.playerId;
      }

      // Create new player
      const player = await this.client.player.create({
        data: {
          lastName: playerName,
          game: game,
          skill: 1000, // Default skill rating
          uniqueIds: {
            create: {
              uniqueId: steamId,
              game: game,
            },
          },
        },
      });

      return player.playerId;
    } catch (error) {
      console.error(`Failed to get or create player:`, error);
      throw error;
    }
  }

  /**
   * Update player statistics
   */
  async updatePlayerStats(
    playerId: number,
    updates: {
      kills?: number;
      deaths?: number;
      skill?: number;
      shots?: number;
      hits?: number;
      headshots?: number;
    }
  ): Promise<void> {
    try {
      const updateData: Record<string, unknown> = {};

      if (updates.kills !== undefined) {
        updateData.kills = { increment: updates.kills };
      }
      if (updates.deaths !== undefined) {
        updateData.deaths = { increment: updates.deaths };
      }
      if (updates.skill !== undefined) {
        updateData.skill = updates.skill;
      }
      if (updates.shots !== undefined) {
        updateData.shots = { increment: updates.shots };
      }
      if (updates.hits !== undefined) {
        updateData.hits = { increment: updates.hits };
      }
      if (updates.headshots !== undefined) {
        updateData.headshots = { increment: updates.headshots };
      }

      await this.client.player.update({
        where: { playerId },
        data: updateData,
      });
    } catch (error) {
      console.error(`Failed to update player stats:`, error);
      throw error;
    }
  }

  /**
   * Get player statistics
   */
  async getPlayerStats(playerId: number): Promise<Player | null> {
    try {
      const player = await this.client.player.findUnique({
        where: { playerId },
      });

      return player;
    } catch (error) {
      console.error(`Failed to get player stats:`, error);
      throw error;
    }
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(
    callback: (
      tx: Omit<
        PrismaClient,
        | "$connect"
        | "$disconnect"
        | "$on"
        | "$transaction"
        | "$use"
        | "$extends"
      >
    ) => Promise<T>
  ): Promise<T> {
    return this.client.$transaction(callback);
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    await this.client.$disconnect();
  }
}
