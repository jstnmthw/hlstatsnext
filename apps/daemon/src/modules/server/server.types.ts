export interface IServerService {
  findById(serverId: number): Promise<ServerInfo | null>
  getServer(serverId: number): Promise<ServerInfo | null>
  getServerByAddress(address: string, port: number): Promise<ServerInfo | null>
  getServerGame(serverId: number): Promise<string>
  getServerConfigBoolean(serverId: number, parameter: string, fallback: boolean): Promise<boolean>
  getServerConfig(serverId: number, parameter: string): Promise<string | null>
  getServerModType(serverId: number): Promise<string>
  hasRconCredentials(serverId: number): Promise<boolean>
  findActiveServersWithRcon(maxAgeMinutes?: number): Promise<ServerInfo[]>
  findServersByIds(serverIds: number[]): Promise<ServerInfo[]>
  findAllServersWithRcon(): Promise<ServerInfo[]>

  // Event handlers for server events
  handleServerShutdown?(serverId: number): Promise<void>
  handleStatsUpdate?(serverId: number, stats: Record<string, unknown>): Promise<void>
  handleAdminAction?(adminId: number, action: string, target?: string): Promise<void>
}

export interface ServerInfo {
  serverId: number
  game: string
  name: string
  address: string
  port: number
  lastEvent?: Date
  activeMap?: string
}

export interface ServerStatusUpdate {
  activePlayers: number
  maxPlayers: number
  activeMap: string
  hostname?: string
}

export interface IServerRepository {
  findById(serverId: number): Promise<ServerInfo | null>
  findByAddress(address: string, port: number): Promise<ServerInfo | null>
  getServerConfig(serverId: number, parameter: string): Promise<string | null>
  hasRconCredentials(serverId: number): Promise<boolean>
  findActiveServersWithRcon(maxAgeMinutes?: number): Promise<ServerInfo[]>
  findServersByIds(serverIds: number[]): Promise<ServerInfo[]>
  findAllServersWithRcon(): Promise<ServerInfo[]>

  // RCON status enrichment methods
  updateServerStatusFromRcon(serverId: number, status: ServerStatusUpdate): Promise<void>
  resetMapStats(serverId: number, newMap: string, playerCount?: number): Promise<void>

  // Database-driven MOD configuration methods
  getModDefault(modCode: string, parameter: string): Promise<string | null>
  getServerConfigDefault(parameter: string): Promise<string | null>
}
