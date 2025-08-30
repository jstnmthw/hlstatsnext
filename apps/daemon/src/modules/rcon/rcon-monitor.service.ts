import type { AppContext } from "@/context"
import type { ILogger } from "@/shared/utils/logger.types"
import type { ServerInfo } from "@/modules/server/server.types"
import type { IServerStatusEnricher } from "@/modules/server/enrichers/server-status-enricher"

export interface RconMonitorConfig {
  enabled: boolean
  statusInterval: number
}

export class RconMonitorService {
  private context: AppContext
  private logger: ILogger
  private config: RconMonitorConfig
  private intervalId?: NodeJS.Timeout
  private serverStatusEnricher: IServerStatusEnricher

  constructor(
    context: AppContext,
    config: RconMonitorConfig,
    serverStatusEnricher: IServerStatusEnricher,
  ) {
    this.context = context
    this.logger = context.logger
    this.config = config
    this.serverStatusEnricher = serverStatusEnricher
  }

  start(): void {
    if (!this.config.enabled) {
      this.logger.warn("RCON monitoring disabled by configuration")
      return
    }

    this.logger.ok(`Starting RCON status monitoring (interval: ${this.config.statusInterval}ms)`)

    // Attempt immediate connection on startup
    this.performInitialMonitoring()

    // Set up interval for subsequent checks
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

  private performInitialMonitoring(): void {
    // Execute initial monitoring asynchronously without blocking startup
    setImmediate(async () => {
      try {
        this.logger.debug("Performing initial RCON connection attempt...")
        await this.monitorActiveServers()
        this.logger.debug("Initial RCON monitoring completed")
      } catch (error) {
        this.logger.error(`Error in initial RCON monitoring: ${error}`)
      }
    })
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
      await this.enrichServerStatus(server)
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

  private async enrichServerStatus(server: ServerInfo): Promise<void> {
    await this.serverStatusEnricher.enrichServerStatus(server.serverId)

    this.logger.debug(`Enriched status for server ${server.serverId} (${server.name})`)
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
