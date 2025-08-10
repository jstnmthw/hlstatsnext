import type { DatabaseClient } from "@/database/client"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IServerRepository, ServerInfo } from "./server.types"

export class ServerRepository implements IServerRepository {
  constructor(
    private readonly database: DatabaseClient,
    private readonly logger: ILogger,
  ) {}

  async findById(serverId: number): Promise<ServerInfo | null> {
    try {
      const server = await this.database.prisma.server.findUnique({
        where: { serverId },
        select: {
          serverId: true,
          game: true,
          name: true,
          address: true,
          port: true,
        },
      })

      return server
    } catch (error) {
      this.logger.error(`Failed to find server by ID ${serverId}: ${error}`)
      return null
    }
  }

  async findByAddress(address: string, port: number): Promise<ServerInfo | null> {
    try {
      const server = await this.database.prisma.server.findFirst({
        where: {
          address,
          port,
        },
        select: {
          serverId: true,
          game: true,
          name: true,
          address: true,
          port: true,
        },
      })

      return server
    } catch (error) {
      this.logger.error(`Failed to find server by address ${address}:${port}: ${error}`)
      return null
    }
  }

  async getServerConfig(serverId: number, parameter: string): Promise<string | null> {
    try {
      const row = await this.database.prisma.serverConfig.findUnique({
        where: { serverId_parameter: { serverId, parameter } },
        select: { value: true },
      })
      if (row) return row.value

      // Fallback to defaults if no per-server value exists
      const def = await this.database.prisma.serverConfigDefault.findUnique({
        where: { parameter },
        select: { value: true },
      })
      return def?.value ?? null
    } catch (error) {
      this.logger.error(`Failed to read server config ${parameter} for ${serverId}: ${error}`)
      return null
    }
  }
}
