/**
 * Server State Manager
 *
 * Centralized state management for game servers including round tracking,
 * map changes, and match state. Extracted from parsers for better separation of concerns.
 */

import type { ILogger } from "@/shared/utils/logger.types"

/**
 * Server state data structure
 */
export interface ServerState {
  /** Current active map */
  currentMap: string

  /** Last winning team for round end events */
  lastWinningTeam?: string

  /** Current round number */
  currentRound: number

  /** Round start time */
  roundStartTime?: Date

  /** Match state */
  matchState: "waiting" | "active" | "ended"

  /** Player counts by team */
  teamCounts: {
    terrorists: number
    counterTerrorists: number
    spectators: number
  }

  /** Max players for the server */
  maxPlayers: number

  /** Last activity timestamp */
  lastActivity: Date
}

/**
 * Server state change event
 */
export interface ServerStateChange {
  serverId: number
  changeType: "map_change" | "round_start" | "round_end" | "team_win" | "player_count"
  previousState: Partial<ServerState>
  newState: Partial<ServerState>
  timestamp: Date
}

/**
 * Server State Manager
 *
 * Manages server state centrally to keep parsers stateless and
 * provide consistent state tracking across the application.
 */
export class ServerStateManager {
  /** Server states by server ID */
  private readonly serverStates = new Map<number, ServerState>()

  /** State change listeners */
  private readonly stateChangeListeners = new Set<(change: ServerStateChange) => void>()

  constructor(private readonly logger: ILogger) {}

  /**
   * Get server state, creating default if not exists
   */
  getServerState(serverId: number): ServerState {
    let state = this.serverStates.get(serverId)

    if (!state) {
      state = this.createDefaultState()
      this.serverStates.set(serverId, state)

      this.logger.debug(`Created default state for server ${serverId}`)
    }

    return state
  }

  /**
   * Update server map and handle map change logic
   */
  updateMap(serverId: number, newMap: string): { changed: boolean; previousMap?: string } {
    const state = this.getServerState(serverId)
    const previousMap = state.currentMap || undefined

    if (state.currentMap !== newMap) {
      const oldState = { currentMap: state.currentMap }

      state.currentMap = newMap
      state.currentRound = 0 // Reset round counter on map change
      state.lastActivity = new Date()

      this.notifyStateChange({
        serverId,
        changeType: "map_change",
        previousState: oldState,
        newState: { currentMap: newMap, currentRound: 0 },
        timestamp: new Date(),
      })

      this.logger.info(`Map changed for server ${serverId}: ${previousMap} -> ${newMap}`)

      return { changed: true, previousMap }
    }

    return { changed: false }
  }

  /**
   * Start a new round
   */
  startRound(serverId: number): { roundNumber: number } {
    const state = this.getServerState(serverId)
    const previousRound = state.currentRound

    state.currentRound++
    state.roundStartTime = new Date()
    state.lastWinningTeam = undefined // Clear previous winner
    state.lastActivity = new Date()

    this.notifyStateChange({
      serverId,
      changeType: "round_start",
      previousState: { currentRound: previousRound },
      newState: { currentRound: state.currentRound },
      timestamp: new Date(),
    })

    this.logger.debug(`Started round ${state.currentRound} for server ${serverId}`)

    return { roundNumber: state.currentRound }
  }

  /**
   * End current round
   */
  endRound(serverId: number): { roundNumber: number; winningTeam?: string } {
    const state = this.getServerState(serverId)

    state.lastActivity = new Date()

    this.notifyStateChange({
      serverId,
      changeType: "round_end",
      previousState: {},
      newState: {
        currentRound: state.currentRound,
        lastWinningTeam: state.lastWinningTeam,
      },
      timestamp: new Date(),
    })

    this.logger.debug(`Ended round ${state.currentRound} for server ${serverId}`, {
      winningTeam: state.lastWinningTeam,
    })

    return {
      roundNumber: state.currentRound,
      winningTeam: state.lastWinningTeam,
    }
  }

  /**
   * Set winning team for current round
   */
  setWinningTeam(serverId: number, team: string): void {
    const state = this.getServerState(serverId)
    const previousTeam = state.lastWinningTeam

    state.lastWinningTeam = team
    state.lastActivity = new Date()

    this.notifyStateChange({
      serverId,
      changeType: "team_win",
      previousState: { lastWinningTeam: previousTeam },
      newState: { lastWinningTeam: team },
      timestamp: new Date(),
    })

    this.logger.debug(`Team won round for server ${serverId}`, {
      team,
      round: state.currentRound,
    })
  }

  /**
   * Update player counts
   */
  updatePlayerCounts(
    serverId: number,
    counts: { terrorists?: number; counterTerrorists?: number; spectators?: number },
  ): void {
    const state = this.getServerState(serverId)
    const previousCounts = { ...state.teamCounts }

    if (counts.terrorists !== undefined) {
      state.teamCounts.terrorists = counts.terrorists
    }
    if (counts.counterTerrorists !== undefined) {
      state.teamCounts.counterTerrorists = counts.counterTerrorists
    }
    if (counts.spectators !== undefined) {
      state.teamCounts.spectators = counts.spectators
    }

    state.lastActivity = new Date()

    this.notifyStateChange({
      serverId,
      changeType: "player_count",
      previousState: { teamCounts: previousCounts },
      newState: { teamCounts: { ...state.teamCounts } },
      timestamp: new Date(),
    })
  }

  /**
   * Set max players for server
   */
  setMaxPlayers(serverId: number, maxPlayers: number): void {
    const state = this.getServerState(serverId)
    state.maxPlayers = maxPlayers
    state.lastActivity = new Date()
  }

  /**
   * Set match state
   */
  setMatchState(serverId: number, matchState: ServerState["matchState"]): void {
    const state = this.getServerState(serverId)
    state.matchState = matchState
    state.lastActivity = new Date()

    this.logger.debug(`Match state changed for server ${serverId}`, { matchState })
  }

  /**
   * Clear server state (useful for testing or server cleanup)
   */
  clearServerState(serverId: number): void {
    if (this.serverStates.delete(serverId)) {
      this.logger.debug(`Cleared state for server ${serverId}`)
    }
  }

  /**
   * Get all servers with state
   */
  getActiveServers(): number[] {
    return Array.from(this.serverStates.keys())
  }

  /**
   * Register state change listener
   */
  onStateChange(listener: (change: ServerStateChange) => void): () => void {
    this.stateChangeListeners.add(listener)

    // Return unsubscribe function
    return () => {
      this.stateChangeListeners.delete(listener)
    }
  }

  /**
   * Notify all listeners of state change
   */
  private notifyStateChange(change: ServerStateChange): void {
    for (const listener of this.stateChangeListeners) {
      try {
        listener(change)
      } catch (error) {
        this.logger.error(`Error in state change listener`, {
          serverId: change.serverId,
          changeType: change.changeType,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  /**
   * Create default server state
   */
  private createDefaultState(): ServerState {
    return {
      currentMap: "",
      lastWinningTeam: undefined,
      currentRound: 0,
      roundStartTime: undefined,
      matchState: "waiting",
      teamCounts: {
        terrorists: 0,
        counterTerrorists: 0,
        spectators: 0,
      },
      maxPlayers: 0,
      lastActivity: new Date(),
    }
  }

  /**
   * Clean up inactive server states
   */
  cleanupInactiveStates(maxAgeMinutes: number = 60): void {
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000)
    let cleanedCount = 0

    for (const [serverId, state] of this.serverStates.entries()) {
      if (state.lastActivity < cutoffTime) {
        this.serverStates.delete(serverId)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} inactive server states`)
    }
  }

  /**
   * Start periodic cleanup of inactive states
   */
  startPeriodicCleanup(intervalMinutes: number = 30): void {
    setInterval(
      () => {
        this.cleanupInactiveStates()
      },
      intervalMinutes * 60 * 1000,
    )

    this.logger.debug(`Started periodic server state cleanup (every ${intervalMinutes} minutes)`)
  }

  /**
   * Get state manager statistics
   */
  getStats(): {
    activeServers: number
    totalStateChanges: number
    listeners: number
  } {
    return {
      activeServers: this.serverStates.size,
      totalStateChanges: 0, // Could be tracked if needed
      listeners: this.stateChangeListeners.size,
    }
  }
}
