/**
 * RCON Module Type Definitions
 *
 * Provides interfaces and types for Remote Console (RCON) functionality
 * to communicate with game servers and execute commands.
 */

// Service Interfaces
export interface IRconService {
  /**
   * Establish RCON connection to a server
   */
  connect(serverId: number): Promise<void>

  /**
   * Disconnect RCON connection from a server
   */
  disconnect(serverId: number): Promise<void>

  /**
   * Execute a command on the server via RCON
   */
  executeCommand(serverId: number, command: string): Promise<string>

  /**
   * Get current server status
   */
  getStatus(serverId: number): Promise<ServerStatus>

  /**
   * Check if connected to a server
   */
  isConnected(serverId: number): boolean

  /**
   * Disconnect all active connections
   */
  disconnectAll(): Promise<void>
}

export interface IRconRepository {
  /**
   * Get RCON credentials for a server
   */
  getRconCredentials(serverId: number): Promise<RconCredentials | null>

  /**
   * Update server status in database
   */
  updateServerStatus(serverId: number, status: ServerStatus): Promise<void>
}

// Data Types
export interface RconCredentials {
  serverId: number
  address: string
  port: number
  rconPassword: string
  gameEngine: GameEngine
}

export interface RconConnection {
  serverId: number
  protocol: IRconProtocol
  isConnected: boolean
  lastActivity: Date
  connectionAttempts: number
}

export interface ServerStatus {
  map: string
  players: number
  maxPlayers: number
  uptime: number
  fps: number
  version?: string
  hostname?: string
  timestamp: Date
}

// Protocol Types
export interface IRconProtocol {
  /**
   * Connect to the server
   */
  connect(address: string, port: number, password: string): Promise<void>

  /**
   * Disconnect from the server
   */
  disconnect(): Promise<void>

  /**
   * Execute a command and return the response
   */
  execute(command: string): Promise<string>

  /**
   * Check if currently connected
   */
  isConnected(): boolean

  /**
   * Get the protocol type
   */
  getType(): RconProtocolType
}

export enum RconProtocolType {
  SOURCE = "source", // Source Engine (CS:GO, CS2, TF2, etc.)
  GOLDSRC = "goldsrc", // GoldSource Engine (CS 1.6, HL1, etc.)
}

export enum GameEngine {
  GOLDSRC = 1, // HL1 engine
  SOURCE = 2, // HL2 original engine
  SOURCE_2009 = 3, // Orange Box engine
}

// Packet Types for Source RCON Protocol
export enum SourceRconPacketType {
  SERVERDATA_RESPONSE_VALUE = 0,
  SERVERDATA_EXECCOMMAND = 2,
  // eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values
  SERVERDATA_AUTH_RESPONSE = 2, // Same as EXECCOMMAND but for auth responses
  SERVERDATA_AUTH = 3,
}

// Configuration
export interface RconConfig {
  enabled: boolean
  statusInterval: number // milliseconds
  timeout: number // milliseconds
  maxRetries: number
  maxConnectionsPerServer: number
}

// Errors
export class RconError extends Error {
  constructor(
    message: string,
    public readonly code: RconErrorCode,
    public readonly serverId?: number,
  ) {
    super(message)
    this.name = "RconError"
  }
}

export enum RconErrorCode {
  CONNECTION_FAILED = "CONNECTION_FAILED",
  AUTH_FAILED = "AUTH_FAILED",
  TIMEOUT = "TIMEOUT",
  INVALID_RESPONSE = "INVALID_RESPONSE",
  NOT_CONNECTED = "NOT_CONNECTED",
  COMMAND_FAILED = "COMMAND_FAILED",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
}

// Command Types
export interface RconCommand {
  name: string
  execute(protocol: IRconProtocol): Promise<unknown>
  parse(response: string): unknown
}

export interface StatusCommand extends RconCommand {
  name: "status"
  parse(response: string): ServerStatus
}
