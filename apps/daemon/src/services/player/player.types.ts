import type { SkillRating } from "@/services/processor/handlers/ranking.handler"
import type { Player } from "@repo/database"

export interface IPlayerService {
  getPlayerRating(playerId: number): Promise<SkillRating>
  updatePlayerRatings(
    updates: Array<{ playerId: number; newRating: number; gamesPlayed: number }>,
  ): Promise<void>
  getRoundParticipants(
    serverId: number,
    duration: number,
  ): Promise<
    Array<{
      playerId: number
      player: {
        skill: number
        teamkills: number
        kills: number
        deaths: number
      }
    }>
  >
  getOrCreatePlayer(steamId: string, playerName: string, game: string): Promise<number>
  updatePlayerStats(
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
  ): Promise<void>
  getPlayerStats(playerId: number): Promise<Player | null>
  getTopPlayers(limit?: number, game?: string, includeHidden?: boolean): Promise<Player[]>
}
