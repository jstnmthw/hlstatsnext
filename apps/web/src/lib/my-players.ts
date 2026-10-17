export interface MyPlayer {
  playerId: number
  lastName: string
  game: string
  skill: number
  kills: number
  deaths: number
  lastEvent: string | Date | null
  hideRanking: boolean
  displayEvents: boolean
  blockAvatar: boolean
}

export interface MyPlayerPreferences {
  hideRanking?: boolean
  displayEvents?: boolean
  blockAvatar?: boolean
}

export interface MyPlayersOverview {
  players: MyPlayer[]
  /** Without a Steam account there is nothing to claim. */
  steamLinked: boolean
}
