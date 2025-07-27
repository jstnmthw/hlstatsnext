/**
 * Ingress Service
 *
 * Handles UDP server, log parsing, server authentication, and event processing.
 */

import type { IIngressService, IngressOptions, IngressStats } from "./ingress.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { BaseEvent } from "@/shared/types/events"
import type { IEventEmitter } from "@/shared/infrastructure/event-publisher-adapter"
import type { IngressDependencies } from "./ingress.dependencies"
import { UdpServer } from "./udp-server"
import { CsParser } from "./parsers/cs.parser"
import { GameConfig } from "@/config/game.config"

export class IngressService implements IIngressService {
  private readonly udpServer: UdpServer
  private readonly parser: CsParser
  private readonly options: Required<IngressOptions>
  private readonly stats: IngressStats = {
    totalLogsProcessed: 0,
    totalErrors: 0,
    startTime: undefined,
  }
  private running: boolean = false

  constructor(
    private readonly logger: ILogger,
    private readonly eventEmitter: IEventEmitter,
    private readonly dependencies: IngressDependencies,
    options: IngressOptions = {},
  ) {
    this.options = {
      port: 27500,
      host: "0.0.0.0",
      skipAuth: process.env.NODE_ENV === "development",
      logBots: process.env.NODE_ENV === "development",
      ...options,
    }

    this.udpServer = new UdpServer(
      { port: this.options.port, host: this.options.host },
      this.logger,
    )

    this.parser = new CsParser(GameConfig.getDefaultGame())
  }

  async start(): Promise<void> {
    if (this.running) {
      throw new Error("IngressService is already running")
    }

    // Wire up UDP server events
    this.udpServer.on("logReceived", async (payload) => {
      await this.handleLogLine(payload.logLine, payload.serverAddress, payload.serverPort)
    })

    this.udpServer.on("error", (error) => {
      this.logger.error(`UDP server error: ${error.message}`)
    })

    // Start the UDP server
    await this.udpServer.start()

    this.running = true
    this.stats.startTime = new Date()

    this.logger.starting("Ingress Server")
    this.logger.started(`Ingress Server on ${this.options.host}:${this.options.port}`)
  }

  stop(): void {
    if (this.running) {
      this.logger.stopping("Ingress Server")
      this.udpServer.stop()
      this.running = false
    }
  }

  isRunning(): boolean {
    return this.running
  }

  getStats(): IngressStats {
    return {
      ...this.stats,
      uptime: this.stats.startTime ? Date.now() - this.stats.startTime.getTime() : 0,
    }
  }

  async processLogLine(logLine: string): Promise<void> {
    try {
      this.stats.totalLogsProcessed++

      // Check for bot events if they should be ignored
      if (!this.options.logBots && this.isBotEvent(logLine)) {
        this.logger.debug(`Ignoring bot event: ${logLine.split('"')[1] || logLine}`)
        return
      }

      // This method now just processes the log line directly
      // The actual parsing and event processing happens in handleLogLine
    } catch (error) {
      this.stats.totalErrors++
      this.logger.error(
        `Error processing log line: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  private isBotEvent(logLine: string): boolean {
    return logLine.includes("<BOT>")
  }

  private async parseAndProcessLogLine(): Promise<void> {
    // This method is now deprecated in favor of proper parsing
    // The parser should handle all log line parsing
    this.logger.warn("Using deprecated parseAndProcessLogLine method")
  }

  private async handlePlayerConnect(): Promise<void> {
    // This method is deprecated - events should be parsed and emitted via event bus
    this.logger.warn("Using deprecated handlePlayerConnect method")
  }

  private async handlePlayerDisconnect(): Promise<void> {
    // This method is deprecated - events should be parsed and emitted via event bus
    this.logger.warn("Using deprecated handlePlayerDisconnect method")
  }

  private async handlePlayerKill(): Promise<void> {
    // This method is deprecated - events should be parsed and emitted via event bus
    this.logger.warn("Using deprecated handlePlayerKill method")
  }

  private async handleRoundWin(): Promise<void> {
    // This method is deprecated - events should be parsed and emitted via event bus
    this.logger.warn("Using deprecated handleRoundWin method")
  }

  async processRawEvent(
    rawData: string,
    serverAddress: string,
    serverPort: number,
  ): Promise<BaseEvent | null> {
    // Get or authenticate server
    const serverId = await this.authenticateServer(serverAddress, serverPort)
    if (serverId === null) {
      this.logger.warn(`Rejected log from unauthenticated server ${serverAddress}:${serverPort}`)
      return null
    }

    // Parse the raw event
    const parseResult = this.parser.parseLine(rawData, serverId)

    if (!parseResult.success) {
      this.logger.debug(`Failed to parse log line: ${parseResult.error}`)
      return null
    }

    return parseResult.event
  }

  async authenticateServer(address: string, port: number): Promise<number | null> {
    const serverId = await this.dependencies.serverAuthenticator.authenticateServer(address, port)

    // Handle development mode
    if (serverId === -1 && this.options.skipAuth) {
      // Auto-detect game type for new servers in development mode
      const gameDetection = await this.dependencies.gameDetector.detectGame(address, port, [])

      this.logger.info(
        `Detected game ${gameDetection.gameCode} for ${address}:${port} (confidence: ${gameDetection.confidence}, method: ${gameDetection.detection_method})`,
      )

      // Auto-create server in development mode
      const server = await this.dependencies.serverInfoProvider.findOrCreateServer(
        address,
        port,
        gameDetection.gameCode,
      )

      // Cache the created server ID in the authenticator
      await this.dependencies.serverAuthenticator.cacheServer(address, port, server.serverId)

      return server.serverId
    }

    return serverId
  }

  private async handleLogLine(
    logLine: string,
    serverAddress: string,
    serverPort: number,
  ): Promise<void> {
    try {
      // Skip empty lines
      if (!logLine.trim()) {
        return
      }

      // Process the raw event
      const event = await this.processRawEvent(logLine.trim(), serverAddress, serverPort)

      if (event) {
        // Emit event via event emitter (EventBus or Queue)
        await this.eventEmitter.emit(event)
      }
    } catch (error) {
      this.logger.error(`Error processing log line: ${error}`)
    }
  }
}
