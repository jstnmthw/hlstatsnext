/**
 * UDP Server for Game Log Ingress
 *
 * High-performance UDP server that receives game server logs.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import { createSocket, Socket } from "dgram"
import { EventEmitter } from "events"

export interface UdpServerOptions {
  port: number
  host?: string
  /**
   * Kernel receive buffer size (bytes). Without this, the default
   * `net.core.rmem_default` (~212KB on stock Linux) silently drops bursts
   * beyond ~1400 packets at the network stack.
   */
  recvBufferSize?: number
}

export interface LogPayload {
  logLine: string
  serverAddress: string
  serverPort: number
  timestamp: Date
}

export interface ISocketFactory {
  createSocket(type: "udp4" | "udp6"): Socket
}

export class DefaultSocketFactory implements ISocketFactory {
  createSocket(type: "udp4" | "udp6"): Socket {
    return createSocket(type)
  }
}

/**
 * Strip GoldSrc/Source OOB header and "log " prefix from UDP packets.
 *
 * GoldSrc logaddress_add sends: \xff\xff\xff\xff[type]log <text>\x00
 * Source logaddress_add sends:  \xff\xff\xff\xffS<text>\x00
 *
 * We strip the 4-byte OOB header, any trailing nulls, and the "log " prefix.
 */
export function stripPacketHeader(buffer: Buffer): string {
  let offset = 0

  // Strip \xff\xff\xff\xff OOB connectionless header
  if (
    buffer.length >= 4 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xff &&
    buffer[2] === 0xff &&
    buffer[3] === 0xff
  ) {
    offset = 4
    // Skip additional non-printable header bytes (type byte like 0x52 'R', 0x53 'S', etc.)
    while (offset < buffer.length && buffer[offset]! !== undefined && buffer[offset]! > 0x7e) {
      offset++
    }
  }

  // Convert remaining bytes to string
  let logLine = buffer.toString("utf8", offset)

  // Strip null bytes (Source engine terminates with \x00)
  logLine = logLine.replace(/\0/g, "")

  // Strip "log " prefix from GoldSrc logaddress_add
  if (logLine.startsWith("log ")) {
    logLine = logLine.slice(4)
  }

  return logLine.trim()
}

export class UdpServer extends EventEmitter {
  private socket: Socket | null = null
  private readonly options: Required<UdpServerOptions>

  constructor(
    options: UdpServerOptions,
    private readonly logger: ILogger,
    private readonly socketFactory: ISocketFactory = new DefaultSocketFactory(),
  ) {
    super()
    this.options = {
      host: "0.0.0.0",
      recvBufferSize: 8 * 1024 * 1024,
      ...options,
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = this.socketFactory.createSocket("udp4")

        this.socket.on("message", (buffer, rinfo) => {
          // Reject oversized packets to prevent memory exhaustion. Emit a
          // typed event so the caller can increment a metric and surface
          // misconfigured (fragmented) sources that would otherwise be silent.
          if (buffer.length > 4096) {
            this.emit("packetDropped", {
              reason: "oversize",
              sourceAddress: rinfo.address,
              sourcePort: rinfo.port,
              size: buffer.length,
            })
            return
          }

          const logLine = stripPacketHeader(buffer)

          if (logLine) {
            const payload: LogPayload = {
              logLine,
              serverAddress: rinfo.address,
              serverPort: rinfo.port,
              timestamp: new Date(),
            }

            this.emit("logReceived", payload)
          }
        })

        this.socket.on("error", (error) => {
          this.logger.error(`UDP server error: ${error.message}`)
          this.emit("error", error)
        })

        this.socket.bind(this.options.port, this.options.host, () => {
          // Apply receive buffer size AFTER bind — setRecvBufferSize requires
          // an open socket. Failures here are non-fatal; the kernel default
          // still works, just with smaller burst headroom.
          try {
            this.socket?.setRecvBufferSize(this.options.recvBufferSize)
          } catch (error) {
            this.logger.warn(
              `Failed to set UDP recv buffer to ${this.options.recvBufferSize} bytes (need CAP_NET_ADMIN or higher net.core.rmem_max): ${error instanceof Error ? error.message : String(error)}`,
            )
          }
          if (this.options.host === "0.0.0.0") {
            this.logger.warn(
              `UDP server bound to 0.0.0.0:${this.options.port} — any reachable host can send packets; gate at the network layer or set INGRESS_HOST=127.0.0.1`,
            )
          }
          this.logger.info(`UDP server listening on ${this.options.host}:${this.options.port}`)
          resolve()
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.socket) {
        this.socket.close(() => {
          this.logger.info("UDP server stopped")
          this.socket = null
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  isListening(): boolean {
    return this.socket !== null
  }
}
