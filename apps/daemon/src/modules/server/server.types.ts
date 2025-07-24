export interface IServerService {
  getServer(serverId: number): Promise<ServerInfo | null>
  getServerByAddress(address: string, port: number): Promise<ServerInfo | null>
  getServerGame(serverId: number): Promise<string>
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
}
