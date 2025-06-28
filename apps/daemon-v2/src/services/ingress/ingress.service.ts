/**
 * IngressService
 * --------------
 * Wraps the high-performance UdpServer, authenticates the sending game server
 * against the database and converts raw log lines into structured GameEvent
 * objects that are forwarded to the EventProcessor.
 */

import { DatabaseClient } from "@/database/client"
import { EventProcessorService } from "@/services/processor/processor.service"
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
  private readonly processor: EventProcessorService
  private readonly parser: CsParser

  /** Tracks authenticated servers - key = "ip:port", value = serverId */
  private readonly authenticatedServers: Map<string, number> = new Map()

  constructor(
    private readonly port: number = 27500,
    processor?: EventProcessorService,
    dbClient?: DatabaseClient,
    private readonly opts: { skipAuth?: boolean } = {},
  ) {
    this.db = dbClient ?? new DatabaseClient()
    this.processor = processor ?? new EventProcessorService()
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
    const serverKey = `${ip}:${port}`

    // DEV shortcut - if skipAuth is enabled, automatically register unknown servers
    if (this.opts.skipAuth) {
      let serverId = this.authenticatedServers.get(serverKey)

      if (!serverId) {
        // Try to fetch existing server row
        const existing = await this.db.getServerByAddress(ip, port)

        if (existing) {
          serverId = existing.serverId
        } else {
          // Auto-create minimal server record for dev
          const created = await this.db.prisma.server.create({
            data: {
              address: ip,
              port,
              name: `DEV ${ip}:${port}`,
              game: "cstrike", // default until map/game detection implemented
            },
            select: { serverId: true },
          })
          serverId = created.serverId
          logger.info(`Auto-added dev server ${serverKey} (serverId=${serverId})`)
        }

        this.authenticatedServers.set(serverKey, serverId)
      }

      await this.processParsedLine(logLine, serverId)
      return
    }

    // Normal authentication path
    // Check if server is already authenticated
    let serverId = this.authenticatedServers.get(serverKey)

    if (!serverId) {
      // Attempt to find server in DB
      const record = await this.db.getServerByAddress(ip, port)

      if (!record) {
        // Unknown server - ignore all traffic
        logger.warn(`Rejected log line from unrecognised server ${serverKey}`)
        return
      }

      // For legacy auth we trust the IP+port once it has a DB record
      this.authenticatedServers.set(serverKey, record.serverId)
      serverId = record.serverId
      logger.info(`Authorised server ${serverKey} (serverId=${serverId})`)

      // First log line might just be a heartbeat, ignore if it's the authorisation
      // line such as "logaddress_add" etc. Skip processing this first packet.
      return
    }

    // From this point the server is authorised - parse the line.
    await this.processParsedLine(logLine, serverId)
  }

  private async processParsedLine(logLine: string, serverId: number) {
    try {
      if (!this.parser.canParse(logLine)) {
        // Unhandled line format - ignore for now
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

      // Debug: show concise version of successfully parsed line
      const cleanedSuccess = logLine.replace(/^L \d{2}\/\d{2}\/\d{4} - \d{2}:\d{2}:\d{2}:\s*/, "")
      const successSnippet = cleanedSuccess.length > 120 ? `${cleanedSuccess.slice(0, 117)}…` : cleanedSuccess

      logger.debug(`Parser success - ${parseResult.event.eventType}: ${successSnippet}`)

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
