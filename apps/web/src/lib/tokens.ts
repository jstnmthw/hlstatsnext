export interface TokenListItem {
  id: number
  tokenPrefix: string
  name: string
  game: string
  rconAddress: string
  createdAt: string | Date
  expiresAt?: string | Date | null
  revokedAt?: string | Date | null
  lastUsedAt?: string | Date | null
  createdBy: string
  serverCount: number
  status: string
  hasRconPassword: boolean
  __typename?: string
}

export interface NewServerToken {
  name: string
  game: string
  rconPassword?: string
  rconAddress?: string
  expiresAt?: string
}
