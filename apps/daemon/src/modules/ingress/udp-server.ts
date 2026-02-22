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
      ...options,
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = this.socketFactory.createSocket("udp4")

        this.socket.on("message", (buffer, rinfo) => {
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
