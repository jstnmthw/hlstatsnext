import type { ILogger } from "@/shared/utils/logger.types"
import type { IServerService } from "./server.types"
import type { IServerRepository, ServerInfo } from "./server.repository.types"

export class ServerService implements IServerService {
  constructor(
    private readonly repository: IServerRepository,
    private readonly logger: ILogger,
  ) {}

  async getServer(serverId: number): Promise<ServerInfo | null> {
    return await this.repository.findById(serverId)
  }

  async getServerByAddress(address: string, port: number): Promise<ServerInfo | null> {
    return await this.repository.findByAddress(address, port)
  }

  async getServerGame(serverId: number): Promise<string> {
    const server = await this.repository.findById(serverId)

    if (!server) {
      this.logger.warn(`Server ${serverId} not found, defaulting to unknown game type`)
      return "unknown"
    }

    return server.game
  }
}
