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
}
