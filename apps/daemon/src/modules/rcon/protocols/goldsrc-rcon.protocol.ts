/**
 * GoldSource Engine RCON Protocol Implementation
 * 
 * Implements the GoldSource RCON protocol for games like CS 1.6, Half-Life, TFC, DoD, etc.
 * Uses UDP-based challenge-response authentication.
 */

import * as dgram from "node:dgram"
import { BaseRconProtocol } from "./base-rcon.protocol"
import { RconProtocolType, RconError, RconErrorCode } from "../rcon.types"
import type { ILogger } from "@/shared/utils/logger.types"

export class GoldSrcRconProtocol extends BaseRconProtocol {
  private socket: dgram.Socket | null = null
  private challenge: string | null = null
  private serverAddress: string = ""
  private serverPort: number = 0
  private rconPassword: string = ""

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

    this.serverAddress = address
    this.serverPort = port
    this.rconPassword = password

    this.socket = dgram.createSocket("udp4")
    this.setupSocketHandlers()

    try {
      // Get challenge from server
      await this.withTimeout(
        this.getChallengeFromServer(),
        this.connectionTimeout,
        "Challenge request",
      )

      this.setConnected(true)
      this.logger.info(`Connected to GoldSource RCON server at ${address}:${port}`)
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
    this.logger.info("Disconnected from GoldSource RCON server")
  }

  async execute(command: string): Promise<string> {
    this.validateConnection()

    if (!command || command.trim() === "") {
      throw new RconError("Command cannot be empty", RconErrorCode.COMMAND_FAILED)
    }

    if (!this.challenge) {
      throw new RconError("No challenge available", RconErrorCode.NOT_CONNECTED)
    }

    try {
      const response = await this.withTimeout(
        this.sendRconCommand(command.trim()),
        this.commandTimeout,
        `Command execution: ${command}`,
      )

      this.logger.debug(`GoldSource RCON command executed: ${command}`)
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
    return RconProtocolType.GOLDSRC
  }

  private setupSocketHandlers(): void {
    if (!this.socket) return

    this.socket.on("error", (error) => {
      this.logger.error(`GoldSource RCON socket error: ${error.message}`)
      this.setConnected(false)
    })

    this.socket.on("close", () => {
      this.logger.debug("GoldSource RCON socket closed")
      this.setConnected(false)
    })
  }

  private async getChallengeFromServer(): Promise<void> {
    if (!this.socket) {
      throw new RconError("Socket not initialized", RconErrorCode.CONNECTION_FAILED)
    }

    return new Promise((resolve, reject) => {
      const challengeRequest = Buffer.from("????challenge rcon\n")
      const timeout = setTimeout(() => {
        reject(new RconError("Challenge request timeout", RconErrorCode.TIMEOUT))
      }, this.connectionTimeout)

      const onMessage = (msg: Buffer) => {
        clearTimeout(timeout)
        this.socket?.off("message", onMessage)

        const response = msg.toString()
        this.logger.debug(`Challenge response: ${response}`)

        // Parse challenge response: "challenge rcon 123456789"
        const challengeMatch = response.match(/challenge rcon (\d+)/)
        if (challengeMatch && challengeMatch[1]) {
          this.challenge = challengeMatch[1]
          resolve()
        } else {
          reject(new RconError("Invalid challenge response", RconErrorCode.AUTH_FAILED))
        }
      }

      this.socket?.on("message", onMessage)
      this.socket?.send(challengeRequest, this.serverPort, this.serverAddress, (error) => {
        if (error) {
          clearTimeout(timeout)
          this.socket?.off("message", onMessage)
          reject(new RconError(`Failed to send challenge request: ${error.message}`, RconErrorCode.CONNECTION_FAILED))
        }
      })
    })
  }

  private async sendRconCommand(command: string): Promise<string> {
    if (!this.socket || !this.challenge) {
      throw new RconError("Not connected", RconErrorCode.NOT_CONNECTED)
    }

    return new Promise((resolve, reject) => {
      // Format: ????rcon challenge password command
      const rconCommand = `????rcon ${this.challenge} ${this.rconPassword} ${command}\n`
      const commandBuffer = Buffer.from(rconCommand)

      const timeout = setTimeout(() => {
        reject(new RconError("Command timeout", RconErrorCode.TIMEOUT))
      }, this.commandTimeout)

      const onMessage = (msg: Buffer) => {
        clearTimeout(timeout)
        this.socket?.off("message", onMessage)

        const response = msg.toString()
        
        // Remove the initial response marker if present
        const cleanResponse = response.replace(/^\xff\xff\xff\xffl/, "").trim()
        
        if (cleanResponse.includes("Bad rcon_password")) {
          reject(new RconError("Authentication failed", RconErrorCode.AUTH_FAILED))
        } else {
          resolve(cleanResponse)
        }
      }

      this.socket?.on("message", onMessage)
      this.socket?.send(commandBuffer, this.serverPort, this.serverAddress, (error) => {
        if (error) {
          clearTimeout(timeout)
          this.socket?.off("message", onMessage)
          reject(new RconError(`Failed to send command: ${error.message}`, RconErrorCode.COMMAND_FAILED))
        }
      })
    })
  }

  private async cleanup(): Promise<void> {
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.close()
      this.socket = null
    }
    
    this.challenge = null
    this.serverAddress = ""
    this.serverPort = 0
    this.rconPassword = ""
  }
}