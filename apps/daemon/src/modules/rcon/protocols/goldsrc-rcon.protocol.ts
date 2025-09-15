/**
 * GoldSource Engine RCON Protocol Implementation
 *
 * Implements the GoldSource RCON protocol for games like CS 1.6, Half-Life, TFC, DoD, etc.
 * Uses UDP-based challenge-response authentication.
 */

import * as dgram from "node:dgram"
import { BaseRconProtocol } from "./base-rcon.protocol"
import { RconProtocolType, RconError, RconErrorCode } from "../types/rcon.types"
import type { ILogger } from "@/shared/utils/logger.types"
import { FragmentedResponseHandler } from "../handlers/fragment-response.handler"
import { CommandResponseHandler } from "../handlers/command-response.handler"

export class GoldSrcRconProtocol extends BaseRconProtocol {
  private socket: dgram.Socket | null = null
  private challenge: string | null = null
  private serverAddress: string = ""
  private serverPort: number = 0
  private rconPassword: string = ""
  private fragmentHandler: FragmentedResponseHandler
  private responseHandler: CommandResponseHandler

  constructor(logger: ILogger, timeout?: number) {
    super(logger, timeout)
    this.fragmentHandler = new FragmentedResponseHandler(logger)
    this.responseHandler = new CommandResponseHandler(logger)
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

    this.logger.debug(`GoldSrc RCON: Creating UDP socket for ${address}:${port}`)
    this.socket = dgram.createSocket("udp4")
    this.setupSocketHandlers()

    this.logger.debug(`GoldSrc RCON: Socket created, binding to local port...`)

    try {
      this.logger.debug(`GoldSrc RCON: Requesting challenge from ${address}:${port}...`)

      // Get challenge from server
      await this.withTimeout(
        this.getChallengeFromServer(),
        this.connectionTimeout,
        "Challenge request",
      )

      this.setConnected(true)
      this.logger.info(
        `Connected to GoldSource RCON server at ${address}:${port} with challenge: ${this.challenge}`,
      )
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
      this.logger.error(`GoldSource RCON socket error: ${error.message}`, { error: error.stack })
      this.setConnected(false)
    })

    this.socket.on("close", () => {
      this.logger.debug(
        `GoldSource RCON socket closed for ${this.serverAddress}:${this.serverPort}`,
      )
      this.setConnected(false)
    })

    this.socket.on("listening", () => {
      const address = this.socket?.address()
      this.logger.debug(`GoldSource RCON socket listening on ${address?.address}:${address?.port}`)
    })
  }

  private async getChallengeFromServer(): Promise<void> {
    if (!this.socket) {
      throw new RconError("Socket not initialized", RconErrorCode.CONNECTION_FAILED)
    }

    return new Promise((resolve, reject) => {
      const challengeRequest = Buffer.concat([
        Buffer.from([0xff, 0xff, 0xff, 0xff]),
        Buffer.from("challenge rcon\n"),
      ])
      this.logger.debug(
        `GoldSrc RCON: Sending challenge request to ${this.serverAddress}:${this.serverPort}`,
        {
          requestBytes: challengeRequest.length,
          requestHex: challengeRequest.toString("hex"),
          timeout: this.connectionTimeout,
        },
      )

      const timeout = setTimeout(() => {
        this.logger.error(
          `GoldSrc RCON: Challenge request timeout after ${this.connectionTimeout}ms for ${this.serverAddress}:${this.serverPort}`,
        )
        reject(new RconError("Challenge request timeout", RconErrorCode.TIMEOUT))
      }, this.connectionTimeout)

      const onMessage = (msg: Buffer, rinfo: dgram.RemoteInfo) => {
        clearTimeout(timeout)
        this.socket?.off("message", onMessage)

        const response = msg.toString()
        this.logger.debug(
          `GoldSrc RCON: Received challenge response from ${rinfo.address}:${rinfo.port}`,
          {
            responseLength: msg.length,
            responseHex: msg.toString("hex"),
            responseText: response,
            expectedServer: `${this.serverAddress}:${this.serverPort}`,
          },
        )

        // Parse challenge response: "challenge rcon 123456789"
        const challengeMatch = response.match(/challenge rcon (\d+)/)
        if (challengeMatch && challengeMatch[1]) {
          this.challenge = challengeMatch[1]
          this.logger.debug(`GoldSrc RCON: Challenge received: ${this.challenge}`)
          resolve()
        } else {
          this.logger.error(
            `GoldSrc RCON: Invalid challenge response format. Expected 'challenge rcon <number>', got: ${response}`,
          )
          reject(new RconError("Invalid challenge response", RconErrorCode.AUTH_FAILED))
        }
      }

      this.socket?.on("message", onMessage)

      this.socket?.send(challengeRequest, this.serverPort, this.serverAddress, (error) => {
        if (error) {
          clearTimeout(timeout)
          this.socket?.off("message", onMessage)
          this.logger.debug(
            `GoldSrc RCON: Failed to send challenge request to ${this.serverAddress}:${this.serverPort}`,
            {
              error: error.message,
              errorCode: (error as NodeJS.ErrnoException).code || "UNKNOWN",
              errorErrno: (error as NodeJS.ErrnoException).errno || -1,
            },
          )
          reject(
            new RconError(
              `Failed to send challenge request: ${error.message}`,
              RconErrorCode.CONNECTION_FAILED,
            ),
          )
        } else {
          this.logger.debug(
            `GoldSrc RCON: Challenge request sent successfully to ${this.serverAddress}:${this.serverPort}`,
          )
        }
      })
    })
  }

  private async sendRconCommand(command: string): Promise<string> {
    if (!this.socket || !this.challenge) {
      throw new RconError("Not connected", RconErrorCode.NOT_CONNECTED)
    }

    return new Promise((resolve, reject) => {
      const commandBuffer = this.createCommandBuffer(command)

      this.logger.debug(
        `GoldSrc RCON: Sending command to ${this.serverAddress}:${this.serverPort}`,
        {
          command,
          challenge: this.challenge,
          bufferLength: commandBuffer.length,
          bufferHex: commandBuffer.toString("hex").substring(0, 100),
        },
      )

      const timeout = setTimeout(() => {
        reject(new RconError("Command timeout", RconErrorCode.TIMEOUT))
      }, this.commandTimeout)

      const onMessage = this.createMessageHandler(command, resolve, reject, timeout)

      this.socket?.on("message", onMessage)
      this.socket?.send(commandBuffer, this.serverPort, this.serverAddress, (error) => {
        if (error) {
          clearTimeout(timeout)
          this.socket?.removeListener("message", onMessage)
          reject(
            new RconError(`Failed to send command: ${error.message}`, RconErrorCode.COMMAND_FAILED),
          )
        }
      })
    })
  }

  /**
   * Creates command buffer for RCON transmission
   */
  private createCommandBuffer(command: string): Buffer {
    return Buffer.concat([
      Buffer.from([0xff, 0xff, 0xff, 0xff]),
      Buffer.from(`rcon ${this.challenge} ${this.rconPassword} ${command}\n`),
    ])
  }

  /**
   * Creates message handler for command responses
   */
  private createMessageHandler(
    command: string,
    resolve: (value: string) => void,
    reject: (reason: Error) => void,
    timeout: NodeJS.Timeout,
  ) {
    const messageHandler = (msg: Buffer, rinfo: dgram.RemoteInfo) => {
      this.logger.debug(`GoldSrc RCON: Received response from ${rinfo.address}:${rinfo.port}`, {
        command,
        responseLength: msg.length,
        responseHex: msg.toString("hex").substring(0, 100),
      })

      const result = this.processResponse(msg)

      if (result.type === "complete") {
        clearTimeout(timeout)
        this.socket?.removeListener("message", messageHandler)

        const responseResult = this.responseHandler.parseCommandResponse(result.data, command)

        if (responseResult.type === "error") {
          if (responseResult.error.code === RconErrorCode.AUTH_FAILED) {
            this.challenge = null // Clear challenge to force reconnection
          }
          reject(responseResult.error)
        } else {
          resolve(responseResult.response)
        }
      }
      // Incomplete fragments are handled by the fragment handler internally
    }

    return messageHandler
  }

  /**
   * Processes response, handling both fragmented and non-fragmented responses
   */
  private processResponse(
    buffer: Buffer,
  ): { type: "complete"; data: Buffer } | { type: "incomplete" } {
    if (this.fragmentHandler.isFragmentedResponse(buffer)) {
      const result = this.fragmentHandler.processFragment(buffer)

      if (result.type === "complete") {
        return { type: "complete", data: result.assembledData }
      } else if (result.type === "invalid") {
        this.logger.warn(`GoldSrc RCON: Invalid fragmented response: ${result.reason}`)
        return { type: "complete", data: buffer } // Fallback to treating as complete
      }

      return { type: "incomplete" }
    }

    // Non-fragmented response
    return { type: "complete", data: buffer }
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
    this.fragmentHandler.cleanupAll()
  }
}
