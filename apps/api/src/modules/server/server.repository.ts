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
      },
    })
  }

  async createServerWithConfig(data: CreateServerInput) {
    const connectionType = data.connectionType || "external"

    return await db.$transaction(async (tx) => {
      // Step 1: Create the server without configs first
      const server = await tx.server.create({
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
        },
      })

      // Step 2: Copy base server config defaults (exclude Mod if specific mod is provided)
      const defaultConfigsResult = data.mod
        ? await tx.$executeRaw`
            INSERT INTO servers_config (server_id, parameter, value)
            SELECT ${server.serverId}, parameter, value FROM servers_config_default
            WHERE parameter != 'Mod'
          `
        : await tx.$executeRaw`
            INSERT INTO servers_config (server_id, parameter, value)
            SELECT ${server.serverId}, parameter, value FROM servers_config_default
          `

      // Step 3: Copy game-specific defaults (override base defaults)
      const gameConfigsResult = await tx.$executeRaw`
        INSERT INTO servers_config (server_id, parameter, value)
        SELECT ${server.serverId}, parameter, value FROM games_defaults
        WHERE code = ${server.game}
        ON DUPLICATE KEY UPDATE value = VALUES(value)
      `

      // Step 4: Handle mod-specific configuration
      let modConfigsResult = 0
      if (data.mod) {
        // Verify the mod exists in mods_supported before proceeding
        const modExists = await tx.modSupported.findUnique({
          where: { code: data.mod },
        })

        if (!modExists) {
          throw new Error(`Unsupported mod: ${data.mod}. Please select a valid mod.`)
        }

        // First, set the Mod parameter explicitly
        await tx.serverConfig.create({
          data: {
            serverId: server.serverId,
            parameter: "Mod",
            value: data.mod,
          },
        })

        // Then apply all mod-specific configs from mods_defaults
        try {
          const modConfigsRaw = await tx.$executeRaw`
            INSERT INTO servers_config (server_id, parameter, value)
            SELECT ${server.serverId}, parameter, value FROM mods_defaults
            WHERE code = ${data.mod}
            ON DUPLICATE KEY UPDATE value = VALUES(value)
          `
          modConfigsResult = Number(modConfigsRaw)

          // Verify that mod configs were actually copied
          if (modConfigsResult === 0) {
            console.warn(`No mod-specific configs found for mod: ${data.mod}`)
          }
        } catch (error) {
          throw new Error(
            `Failed to apply mod-specific configurations for ${data.mod}: ${error instanceof Error ? error.message : "Unknown error"}`,
          )
        }
      }

      // Return server with configs and count
      const serverWithConfigs = await tx.server.findUnique({
        where: { serverId: server.serverId },
        include: {
          configs: {
            orderBy: { parameter: "asc" },
          },
        },
      })

      if (!serverWithConfigs) {
        throw new Error("Failed to retrieve created server with configurations")
      }

      const configsCount =
        Number(defaultConfigsResult) + Number(gameConfigsResult) + modConfigsResult

      return {
        server: serverWithConfigs,
        configsCount,
      }
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
      // Build update data object with only provided fields
      const updateData: Partial<{
        name: string
        address: string
        port: number
        game: string
        publicAddress: string
        statusUrl: string | null
        rconPassword: string
        connectionType: string
        dockerHost: string | null
        sortOrder: number
      }> = {}

      if (data.name !== undefined) updateData.name = data.name
      if (data.address !== undefined) {
        updateData.address = connectionType === "external" ? data.address || "" : ""
      }
      if (data.port !== undefined) updateData.port = data.port
      if (data.game !== undefined) updateData.game = data.game
      if (data.publicAddress !== undefined) updateData.publicAddress = data.publicAddress
      if (data.statusUrl !== undefined) updateData.statusUrl = data.statusUrl
      if (data.rconPassword !== undefined) updateData.rconPassword = data.rconPassword
      if (data.connectionType !== undefined) updateData.connectionType = connectionType
      if (data.dockerHost !== undefined)
        updateData.dockerHost = connectionType === "docker" ? data.dockerHost : null
      if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder

      // Update the server record
      const server = await tx.server.update({
        where: { serverId },
        data: updateData,
      })

      // Update or create the Mod config entry if mod is provided
      if (data.mod !== undefined) {
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
      }

      return server
    })
  }

  async getAllServers() {
    return await db.server.findMany({
      orderBy: { sortOrder: "asc" },
    })
  }
}
