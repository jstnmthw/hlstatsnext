/**
 * IngressService
 * --------------
 * Wraps the high-performance UdpServer, authenticates the sending game server
 * against the database and converts raw log lines into structured GameEvent
 * objects that are forwarded to the EventProcessor.
 */

import { DatabaseClient } from "@/database/client"
import { ServerService } from "@/services/server/server.service"
import { createEventProcessorService } from "@/services/processor/processor.service"
import type { IEventProcessor } from "@/services/processor/processor.types"
import { UdpServer } from "@/services/ingress/udp-server"
import { CsParser } from "@/services/ingress/parsers/cs.parser"
import { logger } from "@/utils/logger"

export interface IIngressService {
  start(): Promise<void>
  stop(): Promise<void>
}

export class IngressService implements IIngressService {
  private readonly udpServer: UdpServer
  private readonly db: DatabaseClient
  private readonly serverService: ServerService
  private readonly processor: IEventProcessor
  private readonly parser: CsParser

  /** Tracks authenticated servers - key = "ip:port", value = serverId */
  private readonly authenticatedServers: Map<string, number> = new Map()

  constructor(
    private readonly port: number = 27500,
    processor?: IEventProcessor,
    dbClient?: DatabaseClient,
    private readonly opts: { skipAuth?: boolean } = {},
  ) {
    this.db = dbClient ?? new DatabaseClient()
    this.serverService = new ServerService(this.db)
    this.processor = processor ?? createEventProcessorService()
    this.udpServer = new UdpServer({ port: this.port })
    this.parser = new CsParser("csgo")
  }

  async start(): Promise<void> {
    // Wire up UDP server events
    this.udpServer.on("logReceived", async (payload) => {
      await this.handleLogLine(payload.logLine, payload.serverAddress, payload.serverPort)
    })

    this.udpServer.on("error", (err) => {
      logger.failed("UDP Server error", err instanceof Error ? err.message : String(err))
    })

    await this.udpServer.start()
  }

  async stop(): Promise<void> {
    await this.udpServer.stop()
    this.authenticatedServers.clear()
  }

  private async handleLogLine(logLine: string, ip: string, port: number): Promise<void> {
    const authResult = await this.authenticateServer(ip, port)

    if (!authResult.authorised) {
      // Unknown server or failed auth – nothing more to do.
      return
    }

    // Skip parsing the first line after authorisation (legacy behaviour) unless
    // we're running in dev/skipAuth mode.
    if (authResult.skipCurrentLine) {
      return
    }

    await this.processParsedLine(logLine, authResult.serverId)
  }

  /**
   * Authenticates an incoming server based on its IP + port.
   * Returns an object describing the result.
   */
  private async authenticateServer(
    ip: string,
    port: number,
  ): Promise<{ authorised: false } | { authorised: true; serverId: number; skipCurrentLine: boolean }> {
    const serverKey = `${ip}:${port}`

    // Fast-path – server already authenticated.
    const cachedId = this.authenticatedServers.get(serverKey)
    if (cachedId) {
      return { authorised: true, serverId: cachedId, skipCurrentLine: false }
    }

    if (this.opts.skipAuth) {
      // Development mode: create or fetch server record automatically.
      const serverId = await this.ensureDevServer(ip, port)
      this.authenticatedServers.set(serverKey, serverId)
      return { authorised: true, serverId, skipCurrentLine: false }
    }

    // Production/normal path – verify server exists in DB.
    const record = await this.serverService.getServerByAddress(ip, port)

    if (!record) {
      logger.warn(`Rejected log line from unrecognised server ${serverKey}`)
      return { authorised: false }
    }

    // Mark as authenticated.
    this.authenticatedServers.set(serverKey, record.serverId)
    logger.info(`Authorised server ${serverKey} (serverId=${record.serverId})`)

    // As per legacy behaviour we ignore the first packet after authorization.
    return { authorised: true, serverId: record.serverId, skipCurrentLine: true }
  }

  /**
   * In development (skipAuth) mode, guarantee a server record exists for the
   * given IP + port and return its ID. Handles potential race conditions where
   * multiple packets attempt to insert the same server concurrently.
   */
  private async ensureDevServer(ip: string, port: number): Promise<number> {
    const serverKey = `${ip}:${port}`

    // 1. Attempt to fetch an existing record to avoid unnecessary writes.
    const existing = await this.serverService.getServerByAddress(ip, port)
    if (existing) {
      return existing.serverId
    }

    // 2. Insert minimal placeholder record, handling unique-constraint races.
    try {
      const created = await this.db.prisma.server.create({
        data: {
          address: ip,
          port,
          name: `DEV ${serverKey}`,
          game: "cstrike", // Default until map/game detection implemented
        },
        select: { serverId: true },
      })

      logger.info(`Auto-added dev server ${serverKey} (serverId=${created.serverId})`)
      return created.serverId
    } catch (err: unknown) {
      // Prisma uses P2002 for unique-constraint violations.
      if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") {
        const raceExisting = await this.serverService.getServerByAddress(ip, port)
        if (raceExisting) {
          return raceExisting.serverId
        }
      }

      // Anything else – propagate up.
      throw err
    }
  }

  private async processParsedLine(logLine: string, serverId: number) {
    try {
      if (!this.parser.canParse(logLine)) {
        return
      }

      const parseResult = await this.parser.parse(logLine, serverId)

      if (!parseResult.success) {
        // Strip the Source log timestamp ("L 06/28/2025 - 09:00:55: ") for clarity -
        // we already have our own timestamp from the logger.
        const cleaned = logLine.replace(/^L \d{2}\/\d{2}\/\d{4} - \d{2}:\d{2}:\d{2}:\s*/, "")
        const snippet = cleaned.length > 120 ? `${cleaned.slice(0, 117)}…` : cleaned
        logger.debug(`Parser error - ${parseResult.error}: ${snippet}`)
        return
      }

      // Attach raw log line for downstream processors
      const eventWithRaw = {
        ...parseResult.event,
        raw: logLine,
      } as typeof parseResult.event & { raw: string }

      await this.processor.processEvent(eventWithRaw)
    } catch (error) {
      logger.failed(`Failed to process log line`, error instanceof Error ? error.message : String(error))
    }
  }
}
