/**
 * RCON Service Implementation
 * 
 * Manages RCON connections and command execution for game servers.
 * Follows the project's DDD architecture and dependency injection patterns.
 */

import type { 
  IRconService, 
  IRconRepository, 
  RconConnection, 
  ServerStatus,
  RconConfig,
  IRconProtocol,
} from "./rcon.types"
import { RconError, RconErrorCode, GameEngine } from "./rcon.types"
import { SourceRconProtocol } from "./protocols/source-rcon.protocol"
import { GoldSrcRconProtocol } from "./protocols/goldsrc-rcon.protocol"
import type { ILogger } from "@/shared/utils/logger.types"

export class RconService implements IRconService {
  private readonly connections = new Map<number, RconConnection>()
  private readonly config: RconConfig

  constructor(
    private readonly repository: IRconRepository,
    private readonly logger: ILogger,
    config?: Partial<RconConfig>,
  ) {
    this.config = {
      enabled: true,
      statusInterval: 30000,  // 30 seconds
      timeout: 5000,         // 5 seconds
      maxRetries: 3,
      maxConnectionsPerServer: 1,
      ...config,
    }

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
        this.logger.debug(`Connecting to server ${serverId} (attempt ${attempts}/${this.config.maxRetries})`)

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
        
        this.logger.info(`Successfully connected to server ${serverId} via RCON`)
        return

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        if (attempts < this.config.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempts - 1), 5000) // Exponential backoff, max 5s
          this.logger.warn(`Connection attempt ${attempts} failed for server ${serverId}, retrying in ${delay}ms`)
          await this.delay(delay)
        }
      }
    }

    // All attempts failed
    const errorMessage = `Failed to connect to server ${serverId} after ${attempts} attempts`
    this.logger.error(errorMessage, { lastError: lastError?.message })
    
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
      this.logger.info(`Disconnected from server ${serverId}`)
    } catch (error) {
      this.logger.warn(`Error disconnecting from server ${serverId}: ${error}`)
    } finally {
      this.connections.delete(serverId)
    }
  }

  async executeCommand(serverId: number, command: string): Promise<string> {
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
    const disconnectPromises = Array.from(this.connections.keys()).map(serverId =>
      this.disconnect(serverId)
    )

    await Promise.allSettled(disconnectPromises)
    this.connections.clear()
    
    this.logger.info("All RCON connections closed")
  }

  /**
   * Get connection statistics for monitoring
   */
  getConnectionStats(): { serverId: number; isConnected: boolean; lastActivity: Date; attempts: number }[] {
    return Array.from(this.connections.values()).map(conn => ({
      serverId: conn.serverId,
      isConnected: conn.isConnected,
      lastActivity: conn.lastActivity,
      attempts: conn.connectionAttempts,
    }))
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
    // Basic status parsing - can be enhanced based on actual server responses
    const lines = response.split('\n')
    
    // Default status values
    const status: ServerStatus = {
      map: "unknown",
      players: 0,
      maxPlayers: 0,
      uptime: 0,
      fps: 0,
      timestamp: new Date(),
    }

    for (const line of lines) {
      const trimmed = line.trim()
      
      // Parse map info: "map: de_dust2"
      if (trimmed.startsWith("map:")) {
        const mapValue = trimmed.split(":")[1]?.trim()
        if (mapValue) {
          status.map = mapValue
        }
      }
      
      // Parse player count: "players : 12 (16 max)"
      const playerMatch = trimmed.match(/players\s*:\s*(\d+)\s*\((\d+)\s*max\)/)
      if (playerMatch && playerMatch[1] && playerMatch[2]) {
        status.players = parseInt(playerMatch[1], 10)
        status.maxPlayers = parseInt(playerMatch[2], 10)
      }
      
      // Parse server FPS: "fps: 128.5"
      if (trimmed.startsWith("fps:")) {
        const fpsStr = trimmed.split(":")[1]?.trim()
        if (fpsStr) {
          status.fps = parseFloat(fpsStr)
        }
      }
      
      // Parse hostname if available
      if (trimmed.startsWith("hostname:")) {
        status.hostname = trimmed.split(":")[1]?.trim()
      }
      
      // Parse version if available
      if (trimmed.startsWith("version:")) {
        status.version = trimmed.split(":")[1]?.trim()
      }
    }

    return status
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}