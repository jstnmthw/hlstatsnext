/**
 * Server Factory
 *
 * Handles server creation with default configuration seeding.
 */
import type { DatabaseClient } from "@/database/client"
import { INGRESS_CONSTANTS } from "@/modules/ingress/types/ingress.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { Prisma } from "@repo/db/client"
import { seedGameDefaults } from "../seeders/seed-game-defaults"
import { seedModDefaults } from "../seeders/seed-mod-defaults"
import { seedServerDefaults } from "../seeders/seed-server-defaults"
import type { ServerRecord } from "../types/server.types"

/**
 * Factory for creating new servers with default configurations
 */
export class ServerFactory {
  constructor(
    private readonly database: DatabaseClient,
    private readonly logger: ILogger,
  ) {}

  /**
   * Creates a new server with all configuration seeding in a single transaction
   */
  async createNewServerWithDefaults(
    address: string,
    port: number,
    gameCode: string,
    serverSelect: Prisma.ServerSelect,
  ): Promise<ServerRecord> {
    return this.database.transaction(async (tx) => {
      // Create the server
      const newServer = await tx.server.create({
        data: {
          game: gameCode,
          address,
          port,
          publicAddress: `${address}:${port}`,
          name: `Server ${address}:${port}`,
          ...INGRESS_CONSTANTS.SERVER_DEFAULTS,
        },
        select: serverSelect,
      })

      const serverId = newServer.serverId

      // Seed all configuration defaults
      await seedServerDefaults(tx, serverId, address, port, this.logger)
      await seedGameDefaults(tx, serverId, gameCode, address, port, this.logger)
      await seedModDefaults(tx, serverId, gameCode, address, port, this.logger)

      return newServer
    })
  }
}
