/**
 * IngressService
 * --------------
 * Wraps the high-performance UdpServer, authenticates the sending game server
 * against the database and converts raw log lines into structured GameEvent
 * objects that are forwarded to the EventProcessor.
 */

import type { GameEvent } from "@/types/common/events";
import { DatabaseClient } from "@/database/client";
import { EventProcessorService } from "@/services/processor/processor.service";
import { UdpServer } from "@/services/ingress/udp-server";
import { CsParser } from "@/services/ingress/parsers/cs.parser";

export interface IIngressService {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export class IngressService implements IIngressService {
  private readonly udpServer: UdpServer;
  private readonly db: DatabaseClient;
  private readonly processor: EventProcessorService;
  private readonly parser: CsParser;

  /** Tracks authenticated servers – key = "ip:port", value = serverId */
  private readonly authenticatedServers: Map<string, number> = new Map();

  constructor(
    private readonly port: number = 27500,
    processor?: EventProcessorService,
    dbClient?: DatabaseClient
  ) {
    this.db = dbClient ?? new DatabaseClient();
    this.processor = processor ?? new EventProcessorService();
    this.udpServer = new UdpServer({ port: this.port });
    this.parser = new CsParser("csgo");
  }

  async start(): Promise<void> {
    // Wire up UDP server events
    this.udpServer.on("logReceived", async (payload) => {
      await this.handleLogLine(
        payload.logLine,
        payload.serverAddress,
        payload.serverPort
      );
    });

    this.udpServer.on("error", (err) => {
      console.error("UDP Server error:", err);
    });

    await this.udpServer.start();
  }

  async stop(): Promise<void> {
    await this.udpServer.stop();
    this.authenticatedServers.clear();
  }

  private async handleLogLine(
    logLine: string,
    ip: string,
    port: number
  ): Promise<void> {
    const serverKey = `${ip}:${port}`;

    // Check if server is already authenticated
    let serverId = this.authenticatedServers.get(serverKey);

    if (!serverId) {
      // Attempt to find server in DB
      const record = await this.db.getServerByAddress(ip, port);

      if (!record) {
        // Unknown server – ignore all traffic
        console.warn(`Rejected log line from unrecognised server ${serverKey}`);
        return;
      }

      // For legacy auth we trust the IP+port once it has a DB record
      this.authenticatedServers.set(serverKey, record.serverId);
      serverId = record.serverId;
      console.log(`Authorised server ${serverKey} (serverId=${serverId})`);

      // First log line might just be a heartbeat, ignore if it's the authorisation
      // line such as "logaddress_add" etc. Skip processing this first packet.
      return;
    }

    // From this point the server is authorised – parse the line.
    try {
      if (!this.parser.canParse(logLine)) {
        // Unhandled line format – ignore for now
        return;
      }

      const parseResult = await this.parser.parse(logLine, serverId);

      if (!parseResult.success) {
        // Log parser error details for debugging
        console.debug(`Parser error: ${parseResult.error}`);
        return;
      }

      // Attach raw log line for debugging
      const event: GameEvent = {
        ...parseResult.event,
        raw: logLine,
      };

      await this.processor.processEvent(event);
    } catch (error) {
      console.error(`Failed to process log line from ${serverKey}:`, error);
    }
  }
}
