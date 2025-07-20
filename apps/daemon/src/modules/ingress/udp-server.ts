/**
 * UDP Server for Game Log Ingress
 *
 * High-performance UDP server that receives game server logs.
 */

import { EventEmitter } from "events"
import { createSocket, Socket } from "dgram"
import type { ILogger } from "@/shared/utils/logger"

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
          const logLine = buffer.toString("utf8").trim()

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
