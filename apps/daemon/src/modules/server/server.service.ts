import type { ILogger } from "@/shared/utils/logger.types"
import type { IServerService } from "./server.types"
import type { IServerRepository, ServerInfo } from "./server.types"

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

  async getServerConfigBoolean(
    serverId: number,
    parameter: string,
    fallback: boolean,
  ): Promise<boolean> {
    const raw = await this.repository.getServerConfig(serverId, parameter)
    if (raw == null) return fallback
    const normalized = raw.trim().toLowerCase()
    if (["1", "true", "yes", "on"].includes(normalized)) return true
    if (["0", "false", "no", "off"].includes(normalized)) return false
    return fallback
  }

  async hasRconCredentials(serverId: number): Promise<boolean> {
    return await this.repository.hasRconCredentials(serverId)
  }

  async findActiveServersWithRcon(maxAgeMinutes?: number): Promise<ServerInfo[]> {
    return await this.repository.findActiveServersWithRcon(maxAgeMinutes)
  }

  async getServerConfig(serverId: number, parameter: string): Promise<string | null> {
    return await this.repository.getServerConfig(serverId, parameter)
  }

  async getServerModType(serverId: number): Promise<string> {
    try {
      const modConfig = await this.repository.getServerConfig(serverId, "Mod")

      // Return the configured MOD type, defaulting to empty string if null
      if (!modConfig || modConfig.trim() === "") {
        return ""
      }

      return modConfig.trim().toUpperCase()
    } catch (error) {
      this.logger.error(`Failed to get MOD type for server ${serverId}: ${error}`)
      return ""
    }
  }
}
