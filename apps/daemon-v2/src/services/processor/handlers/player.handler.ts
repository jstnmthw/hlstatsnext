/**
 * Player Event Handler
 *
 * Processes player-related events (connect, disconnect, kills, etc.)
 * and updates player statistics and records.
 */

import type {
  GameEvent,
  PlayerKillEvent,
  PlayerConnectEvent,
  PlayerDisconnectEvent,
} from "~/types/common/events.types.js";
import type { DatabaseClient } from "~/database/client.js";

export interface HandlerResult {
  success: boolean;
  error?: string;
  playersAffected?: number[];
}

export class PlayerHandler {
  constructor(private db: DatabaseClient) {}

  async handleEvent(event: GameEvent): Promise<HandlerResult> {
    switch (event.eventType) {
      case "PLAYER_CONNECT":
        return this.handlePlayerConnect(event as PlayerConnectEvent);

      case "PLAYER_DISCONNECT":
        return this.handlePlayerDisconnect(event as PlayerDisconnectEvent);

      case "PLAYER_KILL":
        return this.handlePlayerKill(event as PlayerKillEvent);

      default:
        return { success: true }; // Event not handled by this handler
    }
  }

  private async handlePlayerConnect(
    event: PlayerConnectEvent
  ): Promise<HandlerResult> {
    if (event.eventType !== "PLAYER_CONNECT") return { success: true };

    try {
      const data = event.data as any;
      // Get or create player in database
      const playerId = await this.db.getOrCreatePlayer(
        data.steamId,
        data.playerName,
        "csgo" // TODO: Get from server configuration
      );

      console.log(`Player connected: ${data.playerName} (ID: ${playerId})`);

      return {
        success: true,
        playersAffected: [playerId],
      };
    } catch (error) {
      console.error("Failed to handle player connect:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async handlePlayerDisconnect(
    event: PlayerDisconnectEvent
  ): Promise<HandlerResult> {
    if (event.eventType !== "PLAYER_DISCONNECT") return { success: true };

    try {
      const data = event.data as any;
      console.log(
        `Player disconnected: ${data.playerName} (ID: ${data.playerId})`
      );

      return {
        success: true,
        playersAffected: [data.playerId],
      };
    } catch (error) {
      console.error("Failed to handle player disconnect:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async handlePlayerKill(
    event: PlayerKillEvent
  ): Promise<HandlerResult> {
    if (event.eventType !== "PLAYER_KILL") return { success: true };

    try {
      const data = event.data as any;

      // Update killer stats
      await this.db.updatePlayerStats(data.killerId, {
        kills: 1,
        headshots: data.headshot ? 1 : 0,
      });

      // Update victim stats
      await this.db.updatePlayerStats(data.victimId, {
        deaths: 1,
      });

      console.log(
        `Player kill: ${data.killerId} killed ${data.victimId} with ${data.weapon}`
      );

      return {
        success: true,
        playersAffected: [data.killerId, data.victimId],
      };
    } catch (error) {
      console.error("Failed to handle player kill:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
