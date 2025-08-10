export interface IServerService {
  getServer(serverId: number): Promise<ServerInfo | null>
  getServerByAddress(address: string, port: number): Promise<ServerInfo | null>
  getServerGame(serverId: number): Promise<string>
  getServerConfigBoolean(serverId: number, parameter: string, fallback: boolean): Promise<boolean>

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
}

export interface IServerRepository {
  findById(serverId: number): Promise<ServerInfo | null>
  findByAddress(address: string, port: number): Promise<ServerInfo | null>
  getServerConfig(serverId: number, parameter: string): Promise<string | null>
}
