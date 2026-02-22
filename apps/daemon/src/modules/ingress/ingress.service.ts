/**
 * Ingress Service
 *
 * Handles UDP server, log parsing, server authentication, and event processing.
 * Uses token-based authentication with beacons from game server plugins.
 */

import type { IEventPublisher } from "@/shared/infrastructure/messaging/queue/core/types"
import type { BaseEvent } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IngressDependencies } from "./ingress.dependencies"
import type { IIngressService, IngressOptions, IngressStats } from "./ingress.types"
import type { BaseParser } from "./parsers/base.parser"
import { ParserFactory } from "./parsers/parser-factory"
import { UdpServer, type ISocketFactory } from "./udp-server"
import { classifyLine } from "./utils/token-extractor"

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

  /**
   * Process a raw log line from an authenticated server.
   * This method is called after authentication has succeeded.
   */
  async processRawEvent(rawData: string, serverId: number): Promise<BaseEvent | null> {
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

  /**
   * Look up authenticated server by UDP source.
   * Used for engine log lines (not beacons).
   */
  authenticateSource(address: string, port: number): number | undefined {
    return this.dependencies.tokenAuthenticator.lookupSource(address, port)
  }

  getAuthenticatedServerIds(): number[] {
    return this.dependencies.tokenAuthenticator.getAuthenticatedServerIds()
  }

  private async handleLogLine(
    logLine: string,
    serverAddress: string,
    serverPort: number,
  ): Promise<void> {
    try {
      // Skip empty lines
      const trimmedLine = logLine.trim()
      if (!trimmedLine) {
        return
      }

      // Classify the line as beacon or regular log line
      const classified = classifyLine(trimmedLine)

      if (classified.kind === "beacon") {
        // Authentication beacon from plugin
        await this.handleBeacon(classified.token, classified.gamePort, serverAddress, serverPort)
        return // Beacons are not game events
      }

      // Regular engine log line - look up authenticated source
      const serverId = this.authenticateSource(serverAddress, serverPort)
      if (serverId === undefined) {
        // No authentication session — TokenServerAuthenticator logs this with rate limiting
        return
      }

      // Process the log line
      const event = await this.processRawEvent(classified.logLine, serverId)

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

  /**
   * Handle an authentication beacon from the game server plugin.
   */
  private async handleBeacon(
    token: string,
    gamePort: number,
    sourceAddress: string,
    sourcePort: number,
  ): Promise<void> {
    const result = await this.dependencies.tokenAuthenticator.handleBeacon(
      token,
      gamePort,
      sourceAddress,
      sourcePort,
    )

    if (result.kind === "unauthorized") {
      this.logger.warn(`Beacon auth failed from ${sourceAddress}:${sourcePort}: ${result.reason}`)
      return
    }

    if (result.kind === "auto_registered") {
      this.logger.ok(
        `New server auto-registered via beacon: ID ${result.serverId} from ${sourceAddress}`,
      )
    }
  }

  private async getOrCreateParserForServer(serverId: number): Promise<BaseParser> {
    const cached = this.parserCache.get(serverId)
    if (cached) return cached

    // Fetch game for server and create appropriate parser
    const gameCode = await this.dependencies.serverInfoProvider.getServerGame(serverId)
    const parser = ParserFactory.create(
      gameCode,
      this.dependencies.clock,
      this.dependencies.serverStateManager,
    )
    this.parserCache.set(serverId, parser)
    return parser
  }
}
