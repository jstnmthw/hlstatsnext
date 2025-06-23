/**
 * UDP Server for HLStats Log Ingress
 *
 * High-performance UDP server that receives log data from game servers
 * and forwards parsed events to the processing pipeline.
 */

import dgram from "dgram";
import type { AddressInfo } from "net";
import { EventEmitter } from "events";

export interface UdpServerOptions {
  port: number;
  host?: string;
  maxPacketSize?: number;
  rateLimit?: {
    packetsPerMinute: number;
    burstSize: number;
  };
}

export interface ServerInfo {
  address: string;
  port: number;
  lastSeen: Date;
  packetCount: number;
}

export class UdpServer extends EventEmitter {
  private server: dgram.Socket | null = null;
  private readonly options: Required<UdpServerOptions>;
  private readonly connectedServers: Map<string, ServerInfo> = new Map();
  private readonly rateLimiters: Map<string, number[]> = new Map();

  constructor(options: UdpServerOptions) {
    super();

    this.options = {
      host: "0.0.0.0",
      maxPacketSize: 8192,
      rateLimit: {
        packetsPerMinute: 1000,
        burstSize: 50,
      },
      ...options,
    };
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = dgram.createSocket("udp4");

      this.server.on("message", this.handleMessage.bind(this));
      this.server.on("error", this.handleError.bind(this));
      this.server.on("listening", () => {
        const address = this.server?.address();
        console.log(
          `UDP server listening on ${address?.address}:${address?.port}`,
        );
        resolve();
      });

      this.server.bind(this.options.port, this.options.host);
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          console.log("UDP server stopped");
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private handleMessage(message: Buffer, remoteInfo: dgram.RemoteInfo): void {
    const serverKey = `${remoteInfo.address}:${remoteInfo.port}`;

    try {
      // Check rate limiting
      if (!this.checkRateLimit(serverKey)) {
        console.warn(`Rate limit exceeded for server ${serverKey}`);
        return;
      }

      // Update server tracking
      this.updateServerInfo(serverKey, remoteInfo);

      // Validate packet size
      if (message.length > this.options.maxPacketSize) {
        console.warn(
          `Oversized packet from ${serverKey}: ${message.length} bytes`,
        );
        return;
      }

      // Convert to string and emit for processing
      const logLine = message.toString("utf8").trim();
      if (logLine.length > 0) {
        this.emit("logReceived", {
          logLine,
          serverAddress: remoteInfo.address,
          serverPort: remoteInfo.port,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      console.error(`Error processing message from ${serverKey}:`, error);
      this.emit("error", error);
    }
  }

  private handleError(error: Error): void {
    console.error("UDP server error:", error);
    this.emit("error", error);
  }

  private checkRateLimit(serverKey: string): boolean {
    const now = Date.now();
    const timestamps = this.rateLimiters.get(serverKey) || [];

    // Remove timestamps older than 1 minute
    const recentTimestamps = timestamps.filter((t) => now - t < 60000);

    // Check burst limit
    if (recentTimestamps.length >= this.options.rateLimit.burstSize) {
      return false;
    }

    // Check per-minute limit
    if (recentTimestamps.length >= this.options.rateLimit.packetsPerMinute) {
      return false;
    }

    // Add current timestamp and update
    recentTimestamps.push(now);
    this.rateLimiters.set(serverKey, recentTimestamps);

    return true;
  }

  private updateServerInfo(
    serverKey: string,
    remoteInfo: dgram.RemoteInfo,
  ): void {
    const existing = this.connectedServers.get(serverKey);

    if (existing) {
      existing.lastSeen = new Date();
      existing.packetCount++;
    } else {
      this.connectedServers.set(serverKey, {
        address: remoteInfo.address,
        port: remoteInfo.port,
        lastSeen: new Date(),
        packetCount: 1,
      });

      console.log(`New game server connected: ${serverKey}`);
      this.emit("serverConnected", {
        address: remoteInfo.address,
        port: remoteInfo.port,
      });
    }
  }

  /**
   * Get statistics about connected servers
   */
  public getServerStats(): ServerInfo[] {
    return Array.from(this.connectedServers.values());
  }

  /**
   * Get active servers (seen within last 5 minutes)
   */
  public getActiveServers(): ServerInfo[] {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    return Array.from(this.connectedServers.values()).filter(
      (server) => server.lastSeen > fiveMinutesAgo,
    );
  }

  /**
   * Clean up stale server entries (not seen in 1 hour)
   */
  public cleanupStaleServers(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    for (const [key, server] of this.connectedServers.entries()) {
      if (server.lastSeen < oneHourAgo) {
        this.connectedServers.delete(key);
        this.rateLimiters.delete(key);
        console.log(`Removed stale server: ${key}`);
      }
    }
  }

  /**
   * Check if server is listening
   */
  public isListening(): boolean {
    return this.server !== null;
  }

  /**
   * Get server address info
   */
  public address(): AddressInfo | null {
    return this.server?.address() || null;
  }
}
