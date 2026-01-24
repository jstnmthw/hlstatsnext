/**
 * Source Engine RCON Protocol Implementation
 *
 * Implements the Source Engine RCON protocol for games like CS:GO, CS2, TF2, etc.
 * Based on Valve's Source RCON Protocol specification.
 */

import * as net from "node:net"
import { BaseRconProtocol } from "./base-rcon.protocol"
import {
  RconProtocolType,
  SourceRconPacketType,
  RconError,
  RconErrorCode,
} from "../types/rcon.types"
import type { ILogger } from "@/shared/utils/logger.types"

export class SourceRconProtocol extends BaseRconProtocol {
  private socket: net.Socket | null = null
  private packetId = 1
  private pendingResponses = new Map<
    number,
    { resolve: (value: string) => void; reject: (error: Error) => void }
  >()

  constructor(logger: ILogger, timeout?: number) {
    super(logger, timeout)
  }

  async connect(address: string, port: number, password: string): Promise<void> {
    this.validateAddress(address)
    this.validatePort(port)
    this.validatePassword(password)

    if (this.isConnected()) {
      await this.disconnect()
    }

    this.socket = new net.Socket()
    this.setupSocketHandlers()

    try {
      await this.withTimeout(
        this.establishConnection(address, port),
        this.connectionTimeout,
        "Connection establishment",
      )

      await this.withTimeout(this.authenticate(password), this.connectionTimeout, "Authentication")

      this.setConnected(true)
      this.logger.info(`Connected to Source RCON server at ${address}:${port}`)
    } catch (error) {
      await this.cleanup()
      if (error instanceof RconError) {
        throw error
      }
      throw new RconError(
        `Failed to connect: ${error instanceof Error ? error.message : String(error)}`,
        RconErrorCode.CONNECTION_FAILED,
      )
    }
  }

  async disconnect(): Promise<void> {
    if (!this.socket) {
      return
    }

    this.setConnected(false)
    await this.cleanup()
    this.logger.info("Disconnected from Source RCON server")
  }

  async execute(command: string): Promise<string> {
    this.validateConnection()

    if (!command || command.trim() === "") {
      throw new RconError("Command cannot be empty", RconErrorCode.COMMAND_FAILED)
    }

    try {
      const response = await this.withTimeout(
        this.sendCommand(command.trim()),
        this.commandTimeout,
        `Command execution: ${command}`,
      )

      this.logger.debug(`RCON command executed: ${command}`)
      return response
    } catch (error) {
      if (error instanceof RconError) {
        throw error
      }
      throw new RconError(
        `Command failed: ${error instanceof Error ? error.message : String(error)}`,
        RconErrorCode.COMMAND_FAILED,
      )
    }
  }

  getType(): RconProtocolType {
    return RconProtocolType.SOURCE
  }

  private setupSocketHandlers(): void {
    if (!this.socket) return

    this.socket.on("data", (data) => {
      this.handleIncomingData(Buffer.isBuffer(data) ? data : Buffer.from(data))
    })

    this.socket.on("error", (error) => {
      this.logger.error(`Source RCON socket error: ${error.message}`)
      this.setConnected(false)
      this.rejectAllPending(new RconError("Socket error", RconErrorCode.CONNECTION_FAILED))
    })

    this.socket.on("close", () => {
      this.logger.debug("Source RCON socket closed")
      this.setConnected(false)
      this.rejectAllPending(new RconError("Connection closed", RconErrorCode.CONNECTION_FAILED))
    })
  }

  private establishConnection(address: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error("Socket not initialized"))
        return
      }

      this.socket.connect(port, address, () => {
        resolve()
      })

      this.socket.on("error", reject)
    })
  }

  private async authenticate(password: string): Promise<void> {
    const authId = this.getNextPacketId()
    const authPacket = this.createPacket(authId, SourceRconPacketType.SERVERDATA_AUTH, password)

    return new Promise((resolve, reject) => {
      this.pendingResponses.set(authId, {
        resolve: (response) => {
          if (response === "") {
            // Empty response means authentication successful
            resolve()
          } else {
            reject(new RconError("Authentication failed", RconErrorCode.AUTH_FAILED))
          }
        },
        reject,
      })

      this.sendPacket(authPacket)
    })
  }

  private async sendCommand(command: string): Promise<string> {
    const commandId = this.getNextPacketId()
    const commandPacket = this.createPacket(
      commandId,
      SourceRconPacketType.SERVERDATA_EXECCOMMAND,
      command,
    )

    return new Promise((resolve, reject) => {
      this.pendingResponses.set(commandId, { resolve, reject })
      this.sendPacket(commandPacket)
    })
  }

  private createPacket(id: number, type: SourceRconPacketType, body: string): Buffer {
    const bodyBuffer = Buffer.from(body, "ascii")
    const size = 4 + 4 + bodyBuffer.length + 2 // id + type + body + 2 null terminators

    const packet = Buffer.allocUnsafe(4 + size)
    packet.writeInt32LE(size, 0) // Size
    packet.writeInt32LE(id, 4) // ID
    packet.writeInt32LE(type, 8) // Type
    bodyBuffer.copy(packet, 12) // Body
    packet.writeUInt8(0, 12 + bodyBuffer.length) // First null terminator
    packet.writeUInt8(0, 12 + bodyBuffer.length + 1) // Second null terminator

    return packet
  }

  private sendPacket(packet: Buffer): void {
    if (!this.socket || !this.isConnected()) {
      throw new RconError("Not connected", RconErrorCode.NOT_CONNECTED)
    }

    this.socket.write(packet)
  }

  private handleIncomingData(data: Buffer): void {
    let offset = 0

    while (offset < data.length) {
      if (data.length - offset < 4) {
        // Not enough data for size field
        break
      }

      const size = data.readInt32LE(offset)
      const totalPacketSize = size + 4

      if (data.length - offset < totalPacketSize) {
        // Incomplete packet
        break
      }

      const packetData = data.subarray(offset + 4, offset + totalPacketSize)
      this.processPacket(packetData)

      offset += totalPacketSize
    }
  }

  private processPacket(data: Buffer): void {
    if (data.length < 8) {
      this.logger.warn("Received malformed RCON packet")
      return
    }

    const id = data.readInt32LE(0)
    const type = data.readInt32LE(4)
    const bodyLength = data.length - 10 // Subtract id, type, and 2 null terminators
    const body = data.subarray(8, 8 + bodyLength).toString("ascii")

    const pendingResponse = this.pendingResponses.get(id)
    if (pendingResponse) {
      this.pendingResponses.delete(id)

      if (type === SourceRconPacketType.SERVERDATA_AUTH_RESPONSE) {
        // Auth response: ID = -1 means auth failed, otherwise success
        if (id === -1) {
          pendingResponse.reject(new RconError("Authentication failed", RconErrorCode.AUTH_FAILED))
        } else {
          pendingResponse.resolve("")
        }
      } else if (type === SourceRconPacketType.SERVERDATA_RESPONSE_VALUE) {
        pendingResponse.resolve(body)
      } else {
        pendingResponse.reject(
          new RconError("Invalid response type", RconErrorCode.INVALID_RESPONSE),
        )
      }
    }
  }

  private getNextPacketId(): number {
    const id = this.packetId
    this.packetId = (this.packetId + 1) % 0x7fffffff // Keep within positive int32 range
    return id
  }

  private rejectAllPending(error: Error): void {
    for (const response of this.pendingResponses.values()) {
      response.reject(error)
    }
    this.pendingResponses.clear()
  }

  private async cleanup(): Promise<void> {
    this.rejectAllPending(new RconError("Connection closed", RconErrorCode.CONNECTION_FAILED))

    if (this.socket) {
      if (!this.socket.destroyed) {
        this.socket.destroy()
      }
      this.socket = null
    }
  }
}
