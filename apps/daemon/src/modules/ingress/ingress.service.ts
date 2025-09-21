/**
 * Ingress Service
 *
 * Handles UDP server, log parsing, server authentication, and event processing.
 */

import type { IIngressService, IngressOptions, IngressStats } from "./ingress.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { BaseEvent } from "@/shared/types/events"
import type { IEventPublisher } from "@/shared/infrastructure/messaging/queue/core/types"
import type { IngressDependencies } from "./ingress.dependencies"
import type { BaseParser } from "./parsers/base.parser"
import { UdpServer, type ISocketFactory } from "./udp-server"
import { ParserFactory } from "./parsers/parser-factory"

export class IngressService implements IIngressService {
  private readonly udpServer: UdpServer
  private readonly parserCache: Map<number, BaseParser> = new Map()
  private readonly options: Required<IngressOptions>
  private readonly stats: IngressStats = {
    totalLogsProcessed: 0,
    totalErrors: 0,
    startTime: undefined,
  }
  private running: boolean = false
  private eventPublisher: IEventPublisher | null = null

  constructor(
    private readonly logger: ILogger,
    private readonly dependencies: IngressDependencies,
    options: IngressOptions = {},
    socketFactory?: ISocketFactory,
  ) {
    this.options = {
      port: 27500,
      host: "0.0.0.0",
      logBots: false,
      ...options,
    }

    this.udpServer = new UdpServer(
      { port: this.options.port, host: this.options.host },
      this.logger,
      socketFactory,
    )
  }

  setPublisher(publisher: IEventPublisher): void {
    this.eventPublisher = publisher
  }

  async start(): Promise<void> {
    if (this.running) {
      throw new Error("IngressService is already running")
    }

    if (!this.eventPublisher) {
      throw new Error("IngressService requires an event publisher before start()")
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

  async processRawEvent(
    rawData: string,
    serverAddress: string,
    serverPort: number,
  ): Promise<BaseEvent | null> {
    // Get or authenticate server
    const serverId = await this.authenticateServer(serverAddress, serverPort)
    if (serverId === null) {
      // Server authentication failed - authenticator already logged with rate limiting
      return null
    }

    // Select parser for this server based on its game
    const parser = await this.getOrCreateParserForServer(serverId)

    // Parse the raw event
    const parseResult = parser.parseLine(rawData, serverId)

    if (!parseResult.success) {
      // Use warn level for parse failures - these are important to see
      this.logger.warn(`Failed to parse log line from server ${serverId}: ${parseResult.error}`, {
        serverId,
        logLine: rawData.substring(0, 100), // First 100 chars for context
        parseError: parseResult.error,
      })
      this.stats.totalErrors++
      return null
    }

    return parseResult.event
  }

  async authenticateServer(address: string, port: number): Promise<number | null> {
    return await this.dependencies.serverAuthenticator.authenticateServer(address, port)
  }

  getAuthenticatedServerIds(): number[] {
    return this.dependencies.serverAuthenticator.getAuthenticatedServerIds()
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
        if (!this.eventPublisher) {
          this.logger.warn("Event publisher not set; dropping ingress event", {
            eventType: event.eventType,
          })
          return
        }
        // Publish event to queue
        await this.eventPublisher.publish(event)
        this.logger.queue(`Event emitted: ${event.eventType} (Server ID: ${event.serverId})`, {
          eventType: event.eventType,
          serverId: event.serverId,
          eventId: event.eventId,
        })
      }

      this.stats.totalLogsProcessed++
    } catch (error) {
      this.stats.totalErrors++
      this.logger.error(`Error processing log line from ${serverAddress}:${serverPort}: ${error}`, {
        serverAddress,
        serverPort,
        logLine: logLine.substring(0, 100), // First 100 chars for context
        errorMessage: error instanceof Error ? error.message : String(error),
      })
    }
  }

  private async getOrCreateParserForServer(serverId: number): Promise<BaseParser> {
    const cached = this.parserCache.get(serverId)
    if (cached) return cached

    // Fetch game for server and create appropriate parser
    const gameCode = await this.dependencies.serverInfoProvider.getServerGame(serverId)
    const parser = ParserFactory.create(gameCode, this.dependencies.clock)
    this.parserCache.set(serverId, parser)
    return parser
  }
}
