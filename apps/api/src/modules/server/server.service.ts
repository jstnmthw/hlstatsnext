/**
 * Server Management Service
 *
 * Handles server RCON password encryption/decryption and server management.
 */

import type { ICryptoService } from "@repo/crypto"
import type { Server } from "@repo/db/client"
import { ServerRepository } from "./server.repository"
import type { CreateServerInput, CreateServerResult, UpdateServerInput } from "./server.types"

export class ServerService {
  private readonly serverRepository: ServerRepository

  constructor(private readonly crypto: ICryptoService) {
    this.serverRepository = new ServerRepository()
  }

  /**
   * Create a new server with encrypted RCON password
   */
  async createServer(serverData: {
    name: string
    address: string
    port: number
    rconPassword: string
    game?: string
    publicAddress?: string
    statusUrl?: string
  }): Promise<Server> {
    // Encrypt the RCON password
    const encryptedRconPassword = await this.crypto.encrypt(serverData.rconPassword)

    const server = await this.serverRepository.createServer({
      name: serverData.name,
      address: serverData.address,
      port: serverData.port,
      rconPassword: encryptedRconPassword,
      game: serverData.game || "valve",
      publicAddress: serverData.publicAddress,
      statusUrl: serverData.statusUrl,
    })

    return server
  }

  /**
   * Create a new server with encrypted RCON password and configuration defaults
   */
  async createServerWithConfig(input: CreateServerInput): Promise<CreateServerResult> {
    // Encrypt the RCON password before creating server
    const encryptedRconPassword = input.rconPassword
      ? await this.crypto.encrypt(input.rconPassword)
      : undefined

    // Create the server with encrypted password and all configurations in a single transaction
    const serverInput = {
      ...input,
      rconPassword: encryptedRconPassword,
    }

    return await this.serverRepository.createServerWithConfig(serverInput)
  }

  /**
   * Update server RCON password
   */
  async updateRconPassword(serverId: number, newPassword: string): Promise<boolean> {
    if (!newPassword) {
      throw new Error("RCON password is required")
    }

    // Encrypt the new password
    const encryptedPassword = await this.crypto.encrypt(newPassword)

    await this.serverRepository.updateServerWithConfig(serverId, {
      rconPassword: encryptedPassword,
    })

    return true
  }

  /**
   * Get decrypted RCON password for a server (for daemon use)
   */
  async getRconPassword(serverId: number): Promise<string | null> {
    const server = await this.serverRepository.getServerWithConfigs(serverId)

    if (!server || !server.rconPassword) {
      return null
    }

    try {
      // Decrypt the RCON password
      return await this.crypto.decrypt(server.rconPassword)
    } catch (error) {
      console.error("Failed to decrypt RCON password for server", serverId, error)
      return null
    }
  }

  /**
   * Get server details without exposing RCON password
   */
  async getServer(serverId: number): Promise<Omit<Server, "rconPassword"> | null> {
    const server = await this.serverRepository.getServerWithConfigs(serverId)

    if (!server) {
      return null
    }

    // Remove RCON password from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { rconPassword, ...serverWithoutPassword } = server
    return serverWithoutPassword
  }

  /**
   * Get all servers without exposing RCON passwords
   */
  async getAllServers(): Promise<Array<Omit<Server, "rconPassword">>> {
    const servers = await this.serverRepository.getAllServers()

    // Remove RCON passwords from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return servers.map(({ rconPassword, ...server }) => server)
  }

  /**
   * Update server details with optional mod and encrypted RCON password
   */
  async updateServer(serverId: number, updates: UpdateServerInput): Promise<Server> {
    // Encrypt RCON password if provided
    if (updates.rconPassword) {
      updates.rconPassword = await this.crypto.encrypt(updates.rconPassword)
    }

    return await this.serverRepository.updateServerWithConfig(serverId, updates)
  }

  /**
   * Test RCON connection (for validation)
   */
  async testRconConnection(serverId: number): Promise<{ success: boolean; message: string }> {
    try {
      const server = await this.serverRepository.getServerWithConfigs(serverId)

      if (!server) {
        return { success: false, message: "Server not found" }
      }

      const decryptedPassword = await this.crypto.decrypt(server.rconPassword)

      // TODO: Implement actual RCON connection test here
      // For now, just validate that we can decrypt the password
      if (decryptedPassword) {
        return { success: true, message: "RCON password decrypted successfully" }
      } else {
        return { success: false, message: "Failed to decrypt RCON password" }
      }
    } catch (error) {
      console.error("RCON connection test failed:", error)
      return { success: false, message: "RCON connection test failed" }
    }
  }
}
