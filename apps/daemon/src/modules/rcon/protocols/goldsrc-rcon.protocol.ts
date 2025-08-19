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
  private responseFragments: Map<number, Buffer[]> = new Map() // Store fragmented responses

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

    this.logger.debug(`🔍 GoldSrc RCON: Creating UDP socket for ${address}:${port}`)
    this.socket = dgram.createSocket("udp4")
    this.setupSocketHandlers()
    
    this.logger.debug(`🔍 GoldSrc RCON: Socket created, binding to local port...`)

    try {
      this.logger.debug(`🔍 GoldSrc RCON: Requesting challenge from ${address}:${port}...`)
      
      // Get challenge from server
      await this.withTimeout(
        this.getChallengeFromServer(),
        this.connectionTimeout,
        "Challenge request",
      )

      this.setConnected(true)
      this.logger.info(`✅ Connected to GoldSource RCON server at ${address}:${port} with challenge: ${this.challenge}`)
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
      this.logger.error(`❌ GoldSource RCON socket error: ${error.message}`, { error: error.stack })
      this.setConnected(false)
    })

    this.socket.on("close", () => {
      this.logger.debug(`🔌 GoldSource RCON socket closed for ${this.serverAddress}:${this.serverPort}`)
      this.setConnected(false)
    })
    
    this.socket.on("listening", () => {
      const address = this.socket?.address()
      this.logger.debug(`👂 GoldSource RCON socket listening on ${address?.address}:${address?.port}`)
    })
  }

  private async getChallengeFromServer(): Promise<void> {
    if (!this.socket) {
      throw new RconError("Socket not initialized", RconErrorCode.CONNECTION_FAILED)
    }

    return new Promise((resolve, reject) => {
      const challengeRequest = Buffer.concat([
        Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]),
        Buffer.from("challenge rcon\n")
      ])
      this.logger.debug(`📤 GoldSrc RCON: Sending challenge request to ${this.serverAddress}:${this.serverPort}`, {
        requestBytes: challengeRequest.length,
        requestHex: challengeRequest.toString('hex'),
        timeout: this.connectionTimeout
      })
      
      const timeout = setTimeout(() => {
        this.logger.error(`⏰ GoldSrc RCON: Challenge request timeout after ${this.connectionTimeout}ms for ${this.serverAddress}:${this.serverPort}`)
        reject(new RconError("Challenge request timeout", RconErrorCode.TIMEOUT))
      }, this.connectionTimeout)

      const onMessage = (msg: Buffer, rinfo: dgram.RemoteInfo) => {
        clearTimeout(timeout)
        this.socket?.off("message", onMessage)

        const response = msg.toString()
        this.logger.debug(`📥 GoldSrc RCON: Received challenge response from ${rinfo.address}:${rinfo.port}`, {
          responseLength: msg.length,
          responseHex: msg.toString('hex'),
          responseText: response,
          expectedServer: `${this.serverAddress}:${this.serverPort}`
        })

        // Parse challenge response: "challenge rcon 123456789"
        const challengeMatch = response.match(/challenge rcon (\d+)/)
        if (challengeMatch && challengeMatch[1]) {
          this.challenge = challengeMatch[1]
          this.logger.debug(`🎯 GoldSrc RCON: Challenge received: ${this.challenge}`)
          resolve()
        } else {
          this.logger.error(`❌ GoldSrc RCON: Invalid challenge response format. Expected 'challenge rcon <number>', got: ${response}`)
          reject(new RconError("Invalid challenge response", RconErrorCode.AUTH_FAILED))
        }
      }

      this.socket?.on("message", onMessage)
      
      this.socket?.send(challengeRequest, this.serverPort, this.serverAddress, (error) => {
        if (error) {
          clearTimeout(timeout)
          this.socket?.off("message", onMessage)
          this.logger.error(`❌ GoldSrc RCON: Failed to send challenge request to ${this.serverAddress}:${this.serverPort}`, {
            error: error.message,
            errorCode: error.code,
            errorErrno: error.errno
          })
          reject(new RconError(`Failed to send challenge request: ${error.message}`, RconErrorCode.CONNECTION_FAILED))
        } else {
          this.logger.debug(`📤 GoldSrc RCON: Challenge request sent successfully to ${this.serverAddress}:${this.serverPort}`)
        }
      })
    })
  }

  private async sendRconCommand(command: string): Promise<string> {
    if (!this.socket || !this.challenge) {
      throw new RconError("Not connected", RconErrorCode.NOT_CONNECTED)
    }

    return new Promise((resolve, reject) => {
      // Format: \xff\xff\xff\xffrcon challenge password command
      const commandBuffer = Buffer.concat([
        Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]),
        Buffer.from(`rcon ${this.challenge} ${this.rconPassword} ${command}\n`)
      ])
      
      this.logger.debug(`📤 GoldSrc RCON: Sending command to ${this.serverAddress}:${this.serverPort}`, {
        command,
        challenge: this.challenge,
        bufferLength: commandBuffer.length,
        bufferHex: commandBuffer.toString('hex').substring(0, 100)
      })

      const timeout = setTimeout(() => {
        reject(new RconError("Command timeout", RconErrorCode.TIMEOUT))
      }, this.commandTimeout)

      let receivedFragments: Buffer[] = []
      let fragmentTimeout: NodeJS.Timeout | null = null

      const onMessage = (msg: Buffer, rinfo: dgram.RemoteInfo) => {
        // Log raw response for debugging
        this.logger.debug(`📥 GoldSrc RCON: Received response from ${rinfo.address}:${rinfo.port}`, {
          command,
          responseLength: msg.length,
          responseHex: msg.toString('hex').substring(0, 100)
        })

        // Check for fragmented response (starts with 0xFE 0xFF 0xFF 0xFF)
        if (msg.length > 9 && msg[0] === 0xFE && msg[1] === 0xFF && msg[2] === 0xFF && msg[3] === 0xFF) {
          // This is a fragmented response
          // Based on research and actual data: Format is 0xFE 0xFF 0xFF 0xFF [packet ID: 4 bytes] [fragment byte] [data]
          // The fragment byte seems to encode both total and current fragment info
          const packetId = msg.readInt32LE(4)
          const fragmentByte = msg[8]
          
          // Looking at actual data:
          // First fragment had fragmentByte = 0x02 
          // Second fragment had fragmentByte = 0x12
          // This suggests: lower nibble = total fragments, upper nibble = current fragment number
          const totalFragments = fragmentByte & 0x0F
          const currentFragment = (fragmentByte >> 4) & 0x0F
          
          this.logger.debug(`📦 GoldSrc RCON: Fragment ${currentFragment}/${totalFragments - 1} of packet ${packetId} (fragmentByte: 0x${fragmentByte.toString(16)})`)
          
          // Extract the actual data (skip the 9-byte fragment header)
          const fragmentData = msg.subarray(9)
          receivedFragments[currentFragment] = fragmentData
          
          // Check if we have all fragments
          if (receivedFragments.filter(f => f).length === totalFragments) {
            // Clear fragment timeout
            if (fragmentTimeout) {
              clearTimeout(fragmentTimeout)
            }
            clearTimeout(timeout)
            this.socket?.off("message", onMessage)
            
            // Combine all fragments
            const fullResponse = Buffer.concat(receivedFragments.filter(f => f))
            this.parseCommandResponse(fullResponse, command, resolve, reject)
          } else {
            // Set a timeout for remaining fragments
            if (!fragmentTimeout) {
              fragmentTimeout = setTimeout(() => {
                this.socket?.off("message", onMessage)
                reject(new RconError("Incomplete fragmented response", RconErrorCode.TIMEOUT))
              }, 2000) // 2 second timeout for fragments
            }
          }
        } else if (msg.length > 5 && msg[0] === 0xFF && msg[1] === 0xFF && msg[2] === 0xFF && msg[3] === 0xFF) {
          // Non-fragmented response
          clearTimeout(timeout)
          if (fragmentTimeout) clearTimeout(fragmentTimeout)
          this.socket?.off("message", onMessage)
          this.parseCommandResponse(msg, command, resolve, reject)
        } else {
          // Unexpected format
          this.logger.warn(`⚠️ GoldSrc RCON: Unexpected response format`, {
            command,
            hex: msg.toString('hex').substring(0, 50)
          })
          clearTimeout(timeout)
          if (fragmentTimeout) clearTimeout(fragmentTimeout)
          this.socket?.off("message", onMessage)
          resolve(msg.toString())
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

  /**
   * Parse RCON command response
   */
  private parseCommandResponse(
    msg: Buffer, 
    command: string, 
    resolve: (value: string) => void, 
    reject: (reason: Error) => void
  ): void {
    // Check for standard response format (0xFF 0xFF 0xFF 0xFF followed by 'l' or other markers)
    if (msg.length > 5 && msg[0] === 0xFF && msg[1] === 0xFF && msg[2] === 0xFF && msg[3] === 0xFF) {
      const responseType = msg[4]
      let cleanResponse = ""
      
      if (responseType === 0x6C) { // 'l' - long response
        // Skip the 5-byte header (0xFF 0xFF 0xFF 0xFF 'l')
        cleanResponse = msg.toString('utf8', 5).trim()
      } else if (responseType === 0x6E) { // 'n' - normal response  
        // Skip the 5-byte header
        cleanResponse = msg.toString('utf8', 5).trim()
      } else {
        // Try to parse as text after the header
        cleanResponse = msg.toString('utf8', 4).trim()
      }
      
      // Check for error responses
      if (cleanResponse.includes("Bad rcon_password")) {
        this.logger.error(`❌ GoldSrc RCON: Authentication failed - bad password`)
        reject(new RconError("Authentication failed", RconErrorCode.AUTH_FAILED))
      } else if (cleanResponse.includes("Bad challenge")) {
        this.logger.error(`❌ GoldSrc RCON: Bad challenge - need to reconnect`)
        this.challenge = null // Clear challenge to force reconnection
        reject(new RconError("Bad challenge", RconErrorCode.AUTH_FAILED))
      } else {
        this.logger.debug(`✅ GoldSrc RCON: Command '${command}' executed successfully`, { 
          responseLength: cleanResponse.length,
          responsePreview: cleanResponse.substring(0, 200) 
        })
        resolve(cleanResponse)
      }
    } else {
      // Fallback for unexpected formats
      const response = msg.toString('utf8').trim()
      this.logger.warn(`⚠️ GoldSrc RCON: Non-standard response format for command '${command}'`)
      resolve(response)
    }
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
    this.responseFragments.clear()
  }
}