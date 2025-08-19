import type { AppContext } from "@/context"
import type { ILogger } from "@/shared/utils/logger.types"
import type { ServerInfo } from "@/modules/server/server.types"

export interface RconMonitorConfig {
  enabled: boolean
  statusInterval: number
}

export class RconMonitorService {
  private context: AppContext
  private logger: ILogger
  private config: RconMonitorConfig
  private intervalId?: NodeJS.Timeout

  constructor(context: AppContext, config: RconMonitorConfig) {
    this.context = context
    this.logger = context.logger
    this.config = config
  }

  start(): void {
    if (!this.config.enabled) {
      this.logger.warn("RCON monitoring disabled by configuration")
      return
    }

    this.logger.ok(`Starting RCON status monitoring (interval: ${this.config.statusInterval}ms)`)

    this.intervalId = setInterval(async () => {
      try {
        await this.monitorActiveServers()
      } catch (error) {
        this.logger.error(`Error in RCON status monitoring: ${error}`)
      }
    }, this.config.statusInterval)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
      this.logger.info("RCON monitoring stopped")
    }
  }

  private async monitorActiveServers(): Promise<void> {
    try {
      const activeServers = await this.context.serverService.findActiveServersWithRcon()

      if (activeServers.length === 0) {
        this.logger.warn("No active servers with RCON found for monitoring")
        return
      }

      this.logger.debug(`Found ${activeServers.length} active server(s) with RCON for monitoring`)

      for (const server of activeServers) {
        await this.monitorSingleServer(server)
      }
    } catch (error) {
      this.logger.error(`Error discovering active servers for RCON monitoring: ${error}`)
    }
  }

  private async monitorSingleServer(server: ServerInfo): Promise<void> {
    try {
      await this.ensureServerConnection(server)
      await this.getAndLogServerStatus(server)
    } catch (error) {
      await this.handleServerError(server, error)
    }
  }

  private async ensureServerConnection(server: ServerInfo): Promise<void> {
    if (!this.context.rconService.isConnected(server.serverId)) {
      this.logger.info(
        `Attempting RCON connection to server ${server.serverId} (${server.address}:${server.port})...`,
      )
      await this.context.rconService.connect(server.serverId)
      this.logger.ok(`RCON connected to server ${server.serverId} (${server.name})`)
    } else {
      this.logger.debug(`RCON already connected to server ${server.serverId}, getting status...`)
    }
  }

  private async getAndLogServerStatus(server: ServerInfo): Promise<void> {
    const status = await this.context.rconService.getStatus(server.serverId)

    this.logger.ok(
      `Server ${server.serverId} (${server.name}) - Map: ${status.map} | Players: ${status.players}/${status.maxPlayers} | FPS: ${status.fps}`,
    )

    if (status.hostname) {
      this.logger.debug(`Server ${server.serverId} hostname: ${status.hostname}`)
    }
  }

  private async handleServerError(server: ServerInfo, error: unknown): Promise<void> {
    this.logger.error(
      `RCON failed for server ${server.serverId} (${server.name}): ${error instanceof Error ? error.message : String(error)}`,
    )

    try {
      await this.context.rconService.disconnect(server.serverId)
    } catch (disconnectError) {
      this.logger.debug(`Error disconnecting from server ${server.serverId}: ${disconnectError}`)
    }
  }
}
