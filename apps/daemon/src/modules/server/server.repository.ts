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

  async hasRconCredentials(serverId: number): Promise<boolean> {
    try {
      const server = await this.database.prisma.server.findUnique({
        where: { serverId },
        select: { rconPassword: true },
      })

      return server?.rconPassword !== null && server?.rconPassword !== ""
    } catch (error) {
      this.logger.error(`Failed to check RCON credentials for server ${serverId}: ${error}`)
      return false
    }
  }

  async findActiveServersWithRcon(maxAgeMinutes?: number): Promise<ServerInfo[]> {
    try {
      // Use provided value, environment variable, or default to 60 minutes
      const effectiveMaxAge =
        maxAgeMinutes ?? parseInt(process.env.RCON_ACTIVE_SERVER_MAX_AGE_MINUTES || "60", 10)

      const maxAgeDate = new Date(Date.now() - effectiveMaxAge * 60 * 1000)

      const servers = await this.database.prisma.server.findMany({
        where: {
          AND: [
            {
              rconPassword: {
                not: "",
              },
            },
            {
              lastEvent: {
                gte: maxAgeDate,
              },
            },
          ],
        },
        select: {
          serverId: true,
          game: true,
          name: true,
          address: true,
          port: true,
          lastEvent: true,
        },
        orderBy: {
          lastEvent: "desc",
        },
      })

      return servers.map((server) => ({
        serverId: server.serverId,
        game: server.game,
        name: server.name,
        address: server.address,
        port: server.port,
        lastEvent: server.lastEvent || undefined,
      }))
    } catch (error) {
      const effectiveMaxAge =
        maxAgeMinutes ?? parseInt(process.env.RCON_ACTIVE_SERVER_MAX_AGE_MINUTES || "60", 10)
      this.logger.error(
        `Failed to find active servers with RCON (maxAge: ${effectiveMaxAge}min): ${error}`,
      )
      return []
    }
  }

  async getModDefault(modCode: string, parameter: string): Promise<string | null> {
    try {
      const row = await this.database.prisma.modDefault.findUnique({
        where: { code_parameter: { code: modCode, parameter } },
        select: { value: true },
      })
      return row?.value ?? null
    } catch (error) {
      this.logger.error(`Failed to read MOD default ${parameter} for ${modCode}: ${error}`)
      return null
    }
  }

  async getServerConfigDefault(parameter: string): Promise<string | null> {
    try {
      const row = await this.database.prisma.serverConfigDefault.findUnique({
        where: { parameter },
        select: { value: true },
      })
      return row?.value ?? null
    } catch (error) {
      this.logger.error(`Failed to read server config default ${parameter}: ${error}`)
      return null
    }
  }
}
