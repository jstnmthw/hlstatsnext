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
} from "../../../types/common/events.types.js";

export interface HandlerResult {
  success: boolean;
  error?: string;
  playersAffected?: number[];
}

export class PlayerHandler {
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
    // TODO: Update player session, record connection
    const { playerId } = event.data;

    try {
      // Placeholder - will integrate with @repo/database
      console.log(`Player ${playerId} connected to server ${event.serverId}`);

      return {
        success: true,
        playersAffected: [playerId],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async handlePlayerDisconnect(
    event: PlayerDisconnectEvent
  ): Promise<HandlerResult> {
    // TODO: Close player session, update playtime
    const { playerId } = event.data;

    try {
      console.log(
        `Player ${playerId} disconnected from server ${event.serverId}`
      );

      return {
        success: true,
        playersAffected: [playerId],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async handlePlayerKill(
    event: PlayerKillEvent
  ): Promise<HandlerResult> {
    // TODO: Update kill/death stats, weapon stats, calculate rating changes
    const { killerId, victimId } = event.data;

    try {
      console.log(
        `Player ${killerId} killed ${victimId} on server ${event.serverId}`
      );

      return {
        success: true,
        playersAffected: [killerId, victimId],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
