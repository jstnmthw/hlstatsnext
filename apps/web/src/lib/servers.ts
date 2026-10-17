export type ServerListItem = {
  serverId?: number | null
  name?: string | null
  address?: string | null
  port?: number | null
  activePlayers?: number | null
  maxPlayers?: number | null
  activeMap?: string | null
  game?: string | null
  city?: string | null
  country?: string | null
  lastEvent?: string | Date | null
  __typename?: string
}

export interface PublicServerItem {
  serverId?: number | null
  name?: string | null
  address?: string | null
  port?: number | null
  activePlayers?: number | null
  maxPlayers?: number | null
  activeMap?: string | null
  game?: string | null
  city?: string | null
  country?: string | null
  lastEvent?: string | Date | null
}

export interface ServerForEdit {
  serverId: number
  name: string
  address: string
  port: number
  game: string
  publicAddress: string
  rconAddress: string
  statusUrl: string
  sortOrder: number
  mod: string
  authToken: { tokenPrefix: string; name: string } | null
}

export interface ModOption {
  code: string
  name: string
}
