export type PlayerListItem = {
  playerId?: number | null
  lastName?: string | null
  email?: string | null
  country?: string | null
  flag?: string | null
  skill?: number | null
  kills?: number | null
  deaths?: number | null
  lastEvent?: string | Date | null
  lastSkillChange?: string | Date | null
  __typename?: string
}

export interface PublicPlayerItem {
  playerId?: number | null
  lastName?: string | null
  skill?: number | null
  kills?: number | null
  deaths?: number | null
  country?: string | null
  flag?: string | null
  lastEvent?: string | Date | null
}
