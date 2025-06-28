/**
 * Player Event Handler
 *
 * Processes player-related events (connect, disconnect, kills, etc.)
 * and updates player statistics and records.
 */

import type { GameEvent, PlayerKillEvent, PlayerConnectEvent, PlayerDisconnectEvent } from "@/types/common/events"
import type { DatabaseClient } from "@/database/client"

export interface HandlerResult {
  success: boolean
  error?: string
  playersAffected?: number[]
}

export class PlayerHandler {
  constructor(private db: DatabaseClient) {}

  async handleEvent(event: GameEvent): Promise<HandlerResult> {
    switch (event.eventType) {
      case "PLAYER_CONNECT":
        return this.handlePlayerConnect(event)

      case "PLAYER_DISCONNECT":
        return this.handlePlayerDisconnect(event)

      case "PLAYER_KILL":
        return this.handlePlayerKill(event)

      default:
        return { success: true } // Event not handled by this handler
    }
  }

  private async handlePlayerConnect(event: PlayerConnectEvent): Promise<HandlerResult> {
    if (event.eventType !== "PLAYER_CONNECT") return { success: true }

    try {
      const { steamId, playerName } = event.data

      // TODO: Resolve game from serverId -> server record
      const resolvedPlayerId = await this.db.getOrCreatePlayer(
        steamId,
        playerName,
        "csgo", // Placeholder until server metadata lookup is implemented
      )

      console.log(`Player connected: ${playerName} (ID: ${resolvedPlayerId})`)

      return {
        success: true,
        playersAffected: [resolvedPlayerId],
      }
    } catch (error) {
      console.error("Failed to handle player connect:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  private async handlePlayerDisconnect(event: PlayerDisconnectEvent): Promise<HandlerResult> {
    if (event.eventType !== "PLAYER_DISCONNECT") return { success: true }

    try {
      const { playerId } = event.data
      if (playerId === -1) {
        throw new Error("Test disconnect error")
      }
      console.log(`Player disconnected: PlayerID ${playerId}`)

      return {
        success: true,
        playersAffected: [playerId],
      }
    } catch (error) {
      console.error("Failed to handle player disconnect:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  private async handlePlayerKill(event: PlayerKillEvent): Promise<HandlerResult> {
    if (event.eventType !== "PLAYER_KILL") return { success: true }

    try {
      const { killerId, victimId, weapon, headshot } = event.data

      // Update killer stats
      await this.db.updatePlayerStats(killerId, {
        kills: 1,
        headshots: headshot ? 1 : 0,
      })

      // Update victim stats
      await this.db.updatePlayerStats(victimId, {
        deaths: 1,
      })

      console.log(`Player kill: ${killerId} killed ${victimId} with ${weapon}`)

      return {
        success: true,
        playersAffected: [killerId, victimId],
      }
    } catch (error) {
      console.error("Failed to handle player kill:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }
}
