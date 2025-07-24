/**
 * Ingress Service
 *
 * Handles UDP server, log parsing, server authentication, and event processing.
 */

import type { IIngressService, IngressOptions, IngressStats } from "./ingress.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { BaseEvent } from "@/shared/types/events"
import type { DatabaseClient } from "@/database/client"
import { UdpServer } from "./udp-server"
import { CsParser } from "./parsers/cs.parser"
import { EventProcessor } from "@/shared/infrastructure/event-processor"
import type { AppContext } from "@/context"
import { GameConfig } from "@/config/game.config"

export class IngressService implements IIngressService {
  private readonly udpServer: UdpServer
  private readonly parser: CsParser
  private readonly options: Required<IngressOptions>
  private readonly authenticatedServers: Map<string, number> = new Map()
  private eventProcessor: EventProcessor | null = null
  private readonly stats: IngressStats = {
    totalLogsProcessed: 0,
    totalErrors: 0,
    startTime: undefined,
  }
  private running: boolean = false

  constructor(
    private readonly logger: ILogger,
    private readonly database: DatabaseClient,
    private readonly context: AppContext,
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
    this.eventProcessor = new EventProcessor(this.context)
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
      this.authenticatedServers.clear()
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

      // Parse the log line and process events
      await this.parseAndProcessLogLine(logLine)
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

  private async parseAndProcessLogLine(
    logLine: string,
    serverAddress?: string,
    serverPort?: number,
  ): Promise<void> {
    // Extract basic info and process different event types
    if (logLine.includes("connected, address")) {
      if (serverAddress && serverPort) {
        await this.handlePlayerConnect(logLine, serverAddress, serverPort)
      } else {
        this.logger.warn(`Cannot process player connect without server info: ${logLine}`)
      }
    } else if (logLine.includes("disconnected")) {
      await this.handlePlayerDisconnect(logLine)
    } else if (logLine.includes("killed")) {
      await this.handlePlayerKill(logLine)
    } else if (logLine.includes("Round_Start")) {
      this.logger.event("Round started")
    } else if (logLine.includes("Round_Win")) {
      await this.handleRoundWin(logLine)
    } else {
      this.logger.warn(`Unrecognized log format: ${logLine}`)
    }
  }

  private async handlePlayerConnect(
    logLine: string,
    serverAddress: string,
    serverPort: number,
  ): Promise<void> {
    const playerMatch = logLine.match(/"([^"]+)<\d+><([^>]+)><[^>]*>"/)
    if (!playerMatch) return

    const [, playerName, steamId] = playerMatch
    if (!playerName || !steamId) return

    this.logger.event(`Player connect: ${playerName} (${steamId})`)

    // Get server info to determine game type
    const serverId = await this.authenticateServer(serverAddress, serverPort)
    if (!serverId) {
      this.logger.warn(
        `Cannot process player connect - server not authenticated: ${serverAddress}:${serverPort}`,
      )
      return
    }

    // Look up server to get game type
    const server = await this.database.prisma.server.findUnique({
      where: { serverId },
      select: { game: true },
    })

    if (!server) {
      this.logger.error(`Server ${serverId} not found in database`)
      return
    }

    // Create or get player using the server's game type
    await this.context.playerService.getOrCreatePlayer(steamId, playerName, server.game)
  }

  private async handlePlayerDisconnect(logLine: string): Promise<void> {
    const playerMatch = logLine.match(/"([^"]+)<\d+><([^>]+)><[^>]*>"/)
    if (!playerMatch) return

    const [, playerName, steamId] = playerMatch
    this.logger.event(`Player disconnect: ${playerName} (${steamId})`)
  }

  private async handlePlayerKill(logLine: string): Promise<void> {
    const killMatch = logLine.match(
      /"([^"]+)<\d+><([^>]+)><[^>]*>" killed "([^"]+)<\d+><([^>]+)><[^>]*>" with "([^"]+)"(\s+\(headshot\))?/,
    )
    if (!killMatch) return

    const [, killerName, killerSteamId, victimName, victimSteamId, weapon, headshot] = killMatch
    if (!killerSteamId || !victimSteamId || !weapon) return

    const isHeadshot = !!headshot

    this.logger.event(
      `Kill: ${killerName || "Unknown"} → ${victimName || "Unknown"} (${weapon}${isHeadshot ? ", headshot" : ""})`,
    )

    // Get or create players using the available service method
    const killerId = await this.context.playerService.getOrCreatePlayer(
      killerSteamId,
      killerName || "Unknown",
      GameConfig.getDefaultGame(),
    )
    const victimId = await this.context.playerService.getOrCreatePlayer(
      victimSteamId,
      victimName || "Unknown",
      GameConfig.getDefaultGame(),
    )

    // Update killer stats
    await this.context.playerService.updatePlayerStats(killerId, {
      kills: 1,
      headshots: isHeadshot ? 1 : 0,
    })

    // Update victim stats
    await this.context.playerService.updatePlayerStats(victimId, {
      deaths: 1,
    })

    // Update weapon stats using the available service method
    await this.context.weaponService.updateWeaponStats(weapon, {
      shots: 1,
      hits: 1,
      damage: isHeadshot ? 100 : 50,
    })
  }

  private async handleRoundWin(logLine: string): Promise<void> {
    const roundMatch = logLine.match(/Team "([^"]+)" triggered "Round_Win".*\(([^)]+)\)/)
    if (!roundMatch) return

    const [, team, scores] = roundMatch
    if (!team) return

    this.logger.event(`Round won by ${team} (${scores || "unknown score"})`)

    // Assume server ID 1 for now - in real implementation this would be determined from the log source
    // TODO: Implement proper round result handling through match service
    // await this.context.matchService.handleMatchEvent(roundEndEvent)
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
    const serverKey = `${address}:${port}`

    // Check cache first
    if (this.authenticatedServers.has(serverKey)) {
      return this.authenticatedServers.get(serverKey)!
    }

    // Handle authentication based on mode
    if (this.options.skipAuth) {
      // In development mode, try to find or create the server
      try {
        let server = await this.database.prisma.server.findFirst({
          where: {
            address,
            port,
          },
          select: {
            serverId: true,
          },
        })

        if (!server) {
          // Auto-detect game type for new servers in development mode
          const gameDetection = await this.context.gameDetectionService.detectGame(
            address,
            port,
            [],
          )

          this.logger.info(
            `Detected game ${gameDetection.gameCode} for ${serverKey} (confidence: ${gameDetection.confidence}, method: ${gameDetection.detection_method})`,
          )

          // Auto-create server in development mode
          server = await this.database.prisma.server.create({
            data: {
              game: gameDetection.gameCode,
              address,
              port,
              publicaddress: `${address}:${port}`,
              name: `Dev Server ${address}:${port}`,
              rcon_password: "",
              sortorder: 0,
              act_players: 0,
              max_players: 0,
            },
            select: {
              serverId: true,
            },
          })
          this.logger.info(
            `Auto-created development server ${serverKey} with ID ${server.serverId} (game: ${gameDetection.gameCode})`,
          )
        }

        this.authenticatedServers.set(serverKey, server.serverId)
        this.logger.debug(`Development server ${serverKey} mapped to ID ${server.serverId}`)
        return server.serverId
      } catch (error) {
        this.logger.error(`Failed to handle development server ${serverKey}: ${error}`)
        return null
      }
    }

    // Look up server in database
    try {
      const server = await this.database.prisma.server.findFirst({
        where: {
          address,
          port,
        },
        select: {
          serverId: true,
        },
      })

      if (server) {
        this.authenticatedServers.set(serverKey, server.serverId)
        this.logger.info(`Authenticated server ${serverKey} as ID ${server.serverId}`)
        return server.serverId
      } else {
        this.logger.warn(`Unknown server attempted connection: ${serverKey}`)
        return null
      }
    } catch (error) {
      this.logger.error(`Database error during server authentication: ${error}`)
      return null
    }
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
        // Send to event processor
        if (this.eventProcessor) {
          await this.eventProcessor.processEvent(event)
        }
      }
    } catch (error) {
      this.logger.error(`Error processing log line: ${error}`)
    }
  }
}
