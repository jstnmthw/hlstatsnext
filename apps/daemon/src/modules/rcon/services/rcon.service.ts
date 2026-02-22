/**
 * RCON Service Implementation
 *
 * Manages RCON connections and command execution for game servers.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import { GoldSrcStatusParser } from "../parsers/goldsrc-status.parser"
import { GoldSrcRconProtocol } from "../protocols/goldsrc-rcon.protocol"
import { SourceRconProtocol } from "../protocols/source-rcon.protocol"
import type {
  IRconProtocol,
  IRconRepository,
  IRconService,
  RconConfig,
  RconConnection,
  ServerStatus,
} from "../types/rcon.types"
import { GameEngine, RconError, RconErrorCode } from "../types/rcon.types"

export class RconService implements IRconService {
  private readonly connections = new Map<number, RconConnection>()
  private readonly config: RconConfig
  private readonly statusParser: GoldSrcStatusParser

  /** Per-server command queue — serializes RCON commands to prevent half-duplex collisions */
  private readonly commandQueues = new Map<number, Promise<unknown>>()

  constructor(
    private readonly repository: IRconRepository,
    private readonly logger: ILogger,
    config?: Partial<RconConfig>,
  ) {
    this.config = {
      enabled: true,
      statusInterval: 30000, // 30 seconds
      timeout: 5000, // 5 seconds
      maxRetries: 3,
      maxConnectionsPerServer: 1,
      ...config,
    }

    this.statusParser = new GoldSrcStatusParser(logger)
    this.logger.info("RCON service initialized", { config: this.config })
  }

  async connect(serverId: number): Promise<void> {
    if (!this.config.enabled) {
      throw new RconError("RCON service is disabled", RconErrorCode.CONNECTION_FAILED, serverId)
    }

    // Check if already connected
    if (this.isConnected(serverId)) {
      this.logger.debug(`Already connected to server ${serverId}`)
      return
    }

    // Get credentials from repository
    const credentials = await this.repository.getRconCredentials(serverId)
    if (!credentials) {
      throw new RconError(
        `No RCON credentials found for server ${serverId}`,
        RconErrorCode.INVALID_CREDENTIALS,
        serverId,
      )
    }

    // Create protocol instance
    const protocol = this.createProtocol(credentials.gameEngine)

    let attempts = 0
    let lastError: Error | undefined

    while (attempts < this.config.maxRetries) {
      try {
        attempts++
        const engineName = this.getEngineDisplayName(credentials.gameEngine)
        this.logger.info(
          `RCON connecting to ${credentials.address}:${credentials.port} (${engineName}) - attempt ${attempts}/${this.config.maxRetries}`,
        )

        await protocol.connect(credentials.address, credentials.port, credentials.rconPassword)

        // Store connection
        const connection: RconConnection = {
          serverId,
          protocol,
          isConnected: true,
          lastActivity: new Date(),
          connectionAttempts: attempts,
        }

        this.connections.set(serverId, connection)

        this.logger.ok(
          `RCON connected to server ${serverId} (${credentials.address}:${credentials.port}) using ${engineName} protocol`,
        )
        return
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (attempts < this.config.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempts - 1), 5000) // Exponential backoff, max 5s
          this.logger.warn(
            `RCON connection attempt ${attempts} failed for server ${serverId}: ${lastError.message}. Retrying in ${delay}ms...`,
          )
          await this.delay(delay)
        }
      }
    }

    // All attempts failed
    const errorMessage = `RCON connection failed to server ${serverId} after ${attempts} attempts`

    throw new RconError(
      `${errorMessage}: ${lastError?.message}`,
      RconErrorCode.CONNECTION_FAILED,
      serverId,
    )
  }

  async disconnect(serverId: number): Promise<void> {
    const connection = this.connections.get(serverId)
    if (!connection) {
      this.logger.debug(`No connection found for server ${serverId}`)
      return
    }

    try {
      await connection.protocol.disconnect()
      this.logger.info(`RCON disconnected from server ${serverId}`)
    } catch (error) {
      this.logger.warn(`Error disconnecting RCON from server ${serverId}: ${error}`)
    } finally {
      this.connections.delete(serverId)
      this.commandQueues.delete(serverId)
    }
  }

  async executeCommand(serverId: number, command: string): Promise<string> {
    // Serialize commands per server — GoldSrc RCON is half-duplex UDP,
    // concurrent sends corrupt each other's responses.
    const previous = this.commandQueues.get(serverId) ?? Promise.resolve()

    const resultPromise = previous.then(
      () => this.doExecuteCommand(serverId, command),
      () => this.doExecuteCommand(serverId, command), // Continue chain even if previous failed
    )

    // Keep chain alive regardless of success/failure
    this.commandQueues.set(
      serverId,
      resultPromise.catch(() => {}),
    )

    return resultPromise
  }

  private async doExecuteCommand(serverId: number, command: string): Promise<string> {
    const connection = this.getActiveConnection(serverId)

    try {
      const response = await connection.protocol.execute(command)
      connection.lastActivity = new Date()

      this.logger.debug(`Command executed on server ${serverId}: ${command}`)
      return response
    } catch (error) {
      this.logger.error(`Command execution failed on server ${serverId}: ${error}`)

      // Mark connection as failed and remove it
      connection.isConnected = false
      this.connections.delete(serverId)

      if (error instanceof RconError) {
        throw error
      }

      throw new RconError(
        `Command execution failed: ${error instanceof Error ? error.message : String(error)}`,
        RconErrorCode.COMMAND_FAILED,
        serverId,
      )
    }
  }

  async getStatus(serverId: number): Promise<ServerStatus> {
    const response = await this.executeCommand(serverId, "status")
    return this.parseStatusResponse(response)
  }

  isConnected(serverId: number): boolean {
    const connection = this.connections.get(serverId)
    return connection?.isConnected === true && connection.protocol.isConnected()
  }

  async disconnectAll(): Promise<void> {
    const serverIds = Array.from(this.connections.keys())

    if (serverIds.length === 0) {
      this.logger.debug("No RCON connections to close")
      return
    }

    this.logger.info(`Closing ${serverIds.length} RCON connection(s)...`)

    const disconnectPromises = serverIds.map((serverId) => this.disconnect(serverId))

    await Promise.allSettled(disconnectPromises)
    this.connections.clear()
    this.commandQueues.clear()

    this.logger.info("All RCON connections closed")
  }

  getConnectionStats(): {
    serverId: number
    isConnected: boolean
    lastActivity: Date
    attempts: number
  }[] {
    return Array.from(this.connections.values()).map((conn) => ({
      serverId: conn.serverId,
      isConnected: conn.isConnected,
      lastActivity: conn.lastActivity,
      attempts: conn.connectionAttempts,
    }))
  }

  /**
   * Get the engine display name for a server
   */
  async getEngineDisplayNameForServer(serverId: number): Promise<string> {
    try {
      const credentials = await this.repository.getRconCredentials(serverId)
      if (!credentials) {
        return "Unknown"
      }
      return this.getEngineDisplayName(credentials.gameEngine)
    } catch {
      return "Unknown"
    }
  }

  private getActiveConnection(serverId: number): RconConnection {
    const connection = this.connections.get(serverId)

    if (!connection) {
      throw new RconError(
        `No connection found for server ${serverId}`,
        RconErrorCode.NOT_CONNECTED,
        serverId,
      )
    }

    if (!connection.isConnected || !connection.protocol.isConnected()) {
      throw new RconError(
        `Not connected to server ${serverId}`,
        RconErrorCode.NOT_CONNECTED,
        serverId,
      )
    }

    return connection
  }

  private createProtocol(gameEngine: GameEngine): IRconProtocol {
    switch (gameEngine) {
      case GameEngine.SOURCE:
      case GameEngine.SOURCE_2009:
        return new SourceRconProtocol(this.logger, this.config.timeout)

      case GameEngine.GOLDSRC:
        return new GoldSrcRconProtocol(this.logger, this.config.timeout)

      default:
        throw new RconError(
          `Unsupported game engine: ${gameEngine}`,
          RconErrorCode.CONNECTION_FAILED,
        )
    }
  }

  private parseStatusResponse(response: string): ServerStatus {
    // Use the dedicated GoldSrc status parser
    return this.statusParser.parseStatus(response)
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private getEngineDisplayName(gameEngine: GameEngine): string {
    switch (gameEngine) {
      case GameEngine.GOLDSRC:
        return "GoldSource"
      case GameEngine.SOURCE:
        return "Source"
      case GameEngine.SOURCE_2009:
        return "Source 2009"
      default:
        return "Unknown"
    }
  }
}
