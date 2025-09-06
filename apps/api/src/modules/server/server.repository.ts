import { db } from "@repo/database/client"
import type { CreateServerInput, UpdateServerInput, ServerConfigCopyResult } from "./server.types"

export class ServerRepository {
  async createServer(data: CreateServerInput) {
    const connectionType = data.connectionType || "external"

    return await db.server.create({
      data: {
        address: connectionType === "external" ? data.address || "" : "",
        port: data.port,
        game: data.game,
        name: data.name || "",
        rconPassword: data.rconPassword || "",
        publicAddress: data.publicAddress || "",
        statusUrl: data.statusUrl,
        connectionType,
        dockerHost: connectionType === "docker" ? data.dockerHost : null,
        sortOrder: data.sortOrder || 0,
        configs: {
          create: {
            parameter: "Mod",
            value: data.mod || "",
          },
        },
      },
      include: {
        configs: true,
      },
    })
  }

  async copyServerConfigDefaults(serverId: number, game: string): Promise<ServerConfigCopyResult> {
    const result = {
      defaultConfigs: 0,
      gameConfigs: 0,
      modConfigs: 0,
      totalConfigs: 0,
    }

    // Step 1: Copy base server config defaults
    const defaultConfigsResult = await db.$executeRaw`
      INSERT INTO servers_config (server_id, parameter, value)
      SELECT ${serverId}, parameter, value FROM servers_config_default
    `
    result.defaultConfigs = Number(defaultConfigsResult)

    // Step 2: Copy game-specific defaults (override base defaults)
    const gameConfigsResult = await db.$executeRaw`
      INSERT INTO servers_config (server_id, parameter, value)
      SELECT ${serverId}, parameter, value FROM games_defaults
      WHERE code = ${game}
      ON DUPLICATE KEY UPDATE value = VALUES(value)
    `
    result.gameConfigs = Number(gameConfigsResult)

    // Step 3: Get the Mod parameter to apply mod-specific defaults
    const modConfig = await db.serverConfig.findUnique({
      where: {
        serverId_parameter: {
          serverId,
          parameter: "Mod",
        },
      },
    })

    if (modConfig && modConfig.value) {
      // Step 4: Apply mod-specific defaults (override game/base defaults)
      const modConfigsResult = await db.$executeRaw`
        INSERT INTO servers_config (server_id, parameter, value)
        SELECT ${serverId}, parameter, value FROM mods_defaults
        WHERE code = ${modConfig.value}
        ON DUPLICATE KEY UPDATE value = VALUES(value)
      `
      result.modConfigs = Number(modConfigsResult)
    }

    result.totalConfigs = result.defaultConfigs + result.gameConfigs + result.modConfigs

    return result
  }

  async getServerWithConfigs(serverId: number) {
    return await db.server.findUnique({
      where: { serverId },
      include: {
        configs: {
          orderBy: { parameter: "asc" },
        },
      },
    })
  }

  async updateServerWithConfig(serverId: number, data: UpdateServerInput) {
    const connectionType = data.connectionType || "external"

    return await db.$transaction(async (tx) => {
      // Update the server record
      const server = await tx.server.update({
        where: { serverId },
        data: {
          name: data.name || "",
          address: connectionType === "external" ? data.address || "" : "",
          port: data.port,
          game: data.game,
          publicAddress: data.publicAddress || "",
          statusUrl: data.statusUrl,
          rconPassword: data.rconPassword || "",
          connectionType,
          dockerHost: connectionType === "docker" ? data.dockerHost : null,
          sortOrder: data.sortOrder || 0,
        },
      })

      // Update or create the Mod config entry
      await tx.serverConfig.upsert({
        where: {
          serverId_parameter: {
            serverId,
            parameter: "Mod",
          },
        },
        create: {
          serverId,
          parameter: "Mod",
          value: data.mod || "",
        },
        update: {
          value: data.mod || "",
        },
      })

      return server
    })
  }
}
