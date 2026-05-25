/**
 * State Coordinator
 *
 * Sole boundary between the parser layer and ServerStateManager.
 *
 * Every state mutation (map change, round lifecycle, winning team) plus the
 * lookups that depend on prior state go through this class so the parser
 * itself stays a pure orchestrator of regexes + event assembly.
 */

import type { ServerStateManager } from "@/modules/server/state/server-state-manager"

export interface MapChangeResult {
  changed: boolean
  previousMap?: string
}

export interface RoundStartResult {
  roundNumber: number
}

export interface RoundEndResult {
  roundNumber: number
  winningTeam?: string
}

export interface RoundStartContext extends RoundStartResult {
  currentMap: string
  maxPlayers: number
}

export class StateCoordinator {
  constructor(private readonly stateManager: ServerStateManager) {}

  recordMapChange(serverId: number, mapName: string): MapChangeResult {
    return (
      this.stateManager.updateMap(serverId, mapName) ?? {
        changed: true,
        previousMap: undefined,
      }
    )
  }

  beginRound(serverId: number): RoundStartContext {
    const roundInfo = this.stateManager.startRound(serverId) ?? { roundNumber: 1 }
    const serverState = this.stateManager.getServerState(serverId)

    return {
      roundNumber: roundInfo.roundNumber,
      currentMap: serverState?.currentMap || "",
      maxPlayers: serverState?.maxPlayers || 0,
    }
  }

  finishRound(serverId: number): RoundEndResult {
    return (
      this.stateManager.endRound(serverId) ?? {
        roundNumber: 1,
        winningTeam: undefined,
      }
    )
  }

  rememberWinningTeam(serverId: number, team: string): void {
    this.stateManager.setWinningTeam(serverId, team)
  }
}
