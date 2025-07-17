export interface ServerWithStatus {
  id: string
  address: string
  port: number
  name: string | null
  isOnline: boolean
  lastActivity: Date | null
  playerCount: number
}
