import { db } from "@repo/database/client"
import { ServerRepository } from "./server.repository"
import type { CreateServerInput, CreateServerResult } from "./server.types"

export class ServerService {
  private serverRepository: ServerRepository

  constructor() {
    this.serverRepository = new ServerRepository()
  }

  async createServerWithConfig(input: CreateServerInput): Promise<CreateServerResult> {
    return await db.$transaction(async () => {
      // Create the server first
      const server = await this.serverRepository.createServer(input)

      // Copy configuration defaults
      const configResult = await this.serverRepository.copyServerConfigDefaults(
        server.serverId,
        server.game,
      )

      // Get the server with all its configurations
      const serverWithConfigs = await this.serverRepository.getServerWithConfigs(server.serverId)

      if (!serverWithConfigs) {
        throw new Error("Failed to retrieve created server with configurations")
      }

      return {
        server: serverWithConfigs,
        configsCount: configResult.totalConfigs,
      }
    })
  }

  async getServer(serverId: number) {
    return await this.serverRepository.getServerWithConfigs(serverId)
  }
}
