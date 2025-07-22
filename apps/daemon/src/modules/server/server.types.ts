import type { ServerInfo } from "./server.repository.types"

export interface IServerService {
  getServer(serverId: number): Promise<ServerInfo | null>
  getServerByAddress(address: string, port: number): Promise<ServerInfo | null>
  getServerGame(serverId: number): Promise<string>
}
