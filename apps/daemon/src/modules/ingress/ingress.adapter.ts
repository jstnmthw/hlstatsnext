/**
 * Ingress Adapter
 *
 * Adapts existing services to the minimal interfaces required by IngressService.
 * This implements the Adapter pattern to decouple IngressService from concrete implementations.
 */

import type {
  IServerAuthenticator,
  IGameDetector,
  IServerInfoProvider,
  IngressDependencies,
} from "./ingress.dependencies"
import type { DatabaseClient } from "@/database/client"
import type { IGameDetectionService } from "@/modules/game/game-detection.types"
import type { IServerService } from "@/modules/server/server.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { GameDetectionResult } from "@/modules/game/game-detection.types"
import type { Prisma } from "@repo/database/client"
import { isIP } from "node:net"

/**
 * Constants for server authentication and creation
 */
export const INGRESS_CONSTANTS = {
  /** Default game for development mode servers */
  DEFAULT_DEV_GAME: "cstrike",
  /** Sentinel value indicating development mode authentication */
  DEV_AUTH_SENTINEL: -1,
  /** Default server configuration values */
  SERVER_DEFAULTS: {
    rconPassword: "",
    sortOrder: 0,
    activePlayers: 0,
    maxPlayers: 0,
  },
} as const

/**
 * Result of server authentication attempt
 */
export type AuthenticationResult =
  | { kind: "authenticated"; serverId: number }
  | { kind: "unauthorized" }
  | { kind: "dev-mode" }

/**
 * Server record with required fields for creation operations
 */
export interface ServerRecord {
  readonly serverId: number
  readonly city: string | null
  readonly country: string | null
  readonly lat: number | null
  readonly lng: number | null
}

/**
 * Validates server address format
 */
function validateAddress(address: string): void {
  if (!address || typeof address !== "string" || address.trim().length === 0) {
    throw new Error("Address must be a non-empty string")
  }

  // Extract IP part (remove port if included)
  const ipOnly = address.includes(":") ? address.split(":")[0] : address

  // Validate IP format (IPv4 or IPv6)
  if (ipOnly && isIP(ipOnly) === 0) {
    throw new Error(`Invalid IP address format: ${ipOnly}`)
  }
}

/**
 * Validates port number
 */
function validatePort(port: number): void {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Port must be an integer between 1 and 65535, got: ${port}`)
  }
}

/**
 * Validates game code format
 */
function validateGameCode(gameCode: string): void {
  if (!gameCode || typeof gameCode !== "string" || gameCode.trim().length === 0) {
    throw new Error("Game code must be a non-empty string")
  }

  // Basic validation for game code format (alphanumeric and underscores)
  if (!/^[a-zA-Z0-9_]+$/.test(gameCode)) {
    throw new Error(`Invalid game code format: ${gameCode}`)
  }
}

/**
 * Safely converts IPv4 address to BigInt for GeoIP lookup
 * Returns null for invalid IPv4 addresses
 */
function ipv4ToBigInt(ip: string): bigint | null {
  const parts = ip.split(".").map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null
  }

  const [a, b, c, d] = parts
  return (BigInt(a!) << 24n) | (BigInt(b!) << 16n) | (BigInt(c!) << 8n) | BigInt(d!)
}

/**
 * Server authenticator implementation using database
 */
export class DatabaseServerAuthenticator implements IServerAuthenticator {
  private readonly authenticatedServers = new Map<string, number>()

  constructor(
    private readonly database: DatabaseClient,
    private readonly logger: ILogger,
    private readonly skipAuth: boolean = false,
  ) {}

  async authenticateServer(address: string, port: number): Promise<number | null> {
    try {
      validateAddress(address)
      validatePort(port)
    } catch (error) {
      this.logger.warn(`Invalid server credentials: ${error}`)
      return null
    }

    const result = await this.authenticateServerInternal(address, port)

    switch (result.kind) {
      case "authenticated":
        return result.serverId
      case "dev-mode":
        return INGRESS_CONSTANTS.DEV_AUTH_SENTINEL
      case "unauthorized":
        return null
      default: {
        const _exhaustive: never = result
        throw new Error(`Unhandled authentication result: ${JSON.stringify(_exhaustive)}`)
      }
    }
  }

  private async authenticateServerInternal(
    address: string,
    port: number,
  ): Promise<AuthenticationResult> {
    const serverKey = `${address}:${port}`

    // Check cache first
    if (this.authenticatedServers.has(serverKey)) {
      const serverId = this.authenticatedServers.get(serverKey)!
      return serverId === INGRESS_CONSTANTS.DEV_AUTH_SENTINEL
        ? { kind: "dev-mode" }
        : { kind: "authenticated", serverId }
    }

    // In skip auth mode (development), return dev-mode result
    if (this.skipAuth) {
      return { kind: "dev-mode" }
    }

    // Look up server in database
    try {
      const server = await this.database.prisma.server.findFirst({
        where: { address, port },
        select: { serverId: true },
      })

      if (server) {
        this.authenticatedServers.set(serverKey, server.serverId)
        this.logger.info(`Authenticated server ${serverKey} as ID ${server.serverId}`)
        return { kind: "authenticated", serverId: server.serverId }
      } else {
        this.logger.warn(`Unknown server attempted connection: ${serverKey}`)
        return { kind: "unauthorized" }
      }
    } catch (error) {
      this.logger.error(`Database error during server authentication: ${error}`)
      return { kind: "unauthorized" }
    }
  }

  async cacheServer(address: string, port: number, serverId: number): Promise<void> {
    const serverKey = `${address}:${port}`
    this.authenticatedServers.set(serverKey, serverId)
    this.logger.debug(`Cached server ${serverKey} as ID ${serverId}`)
  }

  /**
   * Clear authentication cache
   */
  clearCache(): void {
    this.authenticatedServers.clear()
  }
}

/**
 * Options for GeoIP enrichment
 */
interface GeoEnrichmentOptions {
  readonly address: string
  readonly port: number
  readonly serverId: number
  readonly currentCity: string | null
  readonly currentCountry: string | null
  readonly currentLat: number | null
  readonly currentLng: number | null
}

/**
 * Server information provider implementation
 */
export class ServerInfoProviderAdapter implements IServerInfoProvider {
  private readonly pendingCreations = new Map<string, Promise<ServerRecord>>()

  constructor(
    private readonly database: DatabaseClient,
    private readonly serverService: IServerService,
    private readonly logger: ILogger,
  ) {}

  async getServerGame(serverId: number): Promise<string> {
    // Handle development mode special ID
    if (serverId === INGRESS_CONSTANTS.DEV_AUTH_SENTINEL) {
      return INGRESS_CONSTANTS.DEFAULT_DEV_GAME
    }

    return this.serverService.getServerGame(serverId)
  }

  async findOrCreateServer(address: string, port: number, gameCode: string): Promise<ServerRecord> {
    // Validate inputs
    validateAddress(address)
    validatePort(port)
    validateGameCode(gameCode)

    const serverKey = `${address}:${port}`

    // Check if there's already a pending creation for this server
    const pendingCreation = this.pendingCreations.get(serverKey)
    if (pendingCreation) {
      return pendingCreation
    }

    // Create the server creation promise
    const creationPromise = this.createServerInternal(address, port, gameCode)

    // Store the promise to prevent concurrent creations
    this.pendingCreations.set(serverKey, creationPromise)

    try {
      const result = await creationPromise
      return result
    } finally {
      // Clean up the pending creation regardless of success/failure
      this.pendingCreations.delete(serverKey)
    }
  }

  private async createServerInternal(
    address: string,
    port: number,
    gameCode: string,
  ): Promise<ServerRecord> {
    try {
      const serverSelect = {
        serverId: true,
        city: true,
        country: true,
        lat: true,
        lng: true,
      } satisfies Prisma.ServerSelect

      // First, try to find existing server
      const existingServer = await this.database.prisma.server.findFirst({
        where: { address, port },
        select: serverSelect,
      })

      if (existingServer) {
        return existingServer
      }

      // Server doesn't exist, create it
      try {
        const newServer = await this.createNewServerWithDefaults(
          address,
          port,
          gameCode,
          serverSelect,
        )

        this.logger.info(
          `Auto-created server ${address}:${port} with ID ${newServer.serverId} (game: ${gameCode})`,
        )

        // Best-effort GeoIP enrichment for server location (outside transaction for performance)
        await this.enrichServerWithGeoIP({
          address,
          port,
          serverId: newServer.serverId,
          currentCity: newServer.city,
          currentCountry: newServer.country,
          currentLat: newServer.lat,
          currentLng: newServer.lng,
        })

        return newServer
      } catch (createError) {
        // Handle race condition - another process might have created the server
        if (
          createError &&
          typeof createError === "object" &&
          "code" in createError &&
          (createError as { code: string }).code === "P2002"
        ) {
          this.logger.debug(
            `Race condition detected creating server ${address}:${port}, fetching existing server`,
          )

          // Try to find the server that was created by another process
          const existingServer = await this.database.prisma.server.findFirst({
            where: { address, port },
            select: serverSelect,
          })

          if (!existingServer) {
            throw new Error(
              `Server ${address}:${port} still not found after unique constraint error`,
            )
          }

          return existingServer
        } else {
          throw createError
        }
      }
    } catch (error) {
      throw new Error(`Failed to find or create server: ${error}`)
    }
  }

  /**
   * Seeds server configuration defaults within a transaction
   */
  private async seedServerDefaults(
    tx: Prisma.TransactionClient,
    serverId: number,
    address: string,
    _port: number,
  ): Promise<void> {
    try {
      const defaults = await tx.serverConfigDefault.findMany()
      if (defaults.length > 0) {
        await tx.serverConfig.createMany({
          data: defaults.map((d) => ({
            serverId,
            parameter: d.parameter,
            value: d.value,
          })),
          skipDuplicates: true,
        })
        this.logger.debug(`Seeded ${defaults.length} server config defaults for server ${serverId}`)
      }
    } catch (seedError) {
      this.logger.warn(
        `Failed to seed server config defaults for ${address}:${_port}: ${seedError}`,
      )
      // Continue with transaction - seeding failures shouldn't fail server creation
    }
  }

  /**
   * Seeds game-specific configuration defaults within a transaction
   */
  private async seedGameDefaults(
    tx: Prisma.TransactionClient,
    serverId: number,
    gameCode: string,
    address: string,
    _port: number,
  ): Promise<void> {
    try {
      const gameDefaults = await tx.gameDefault.findMany({
        where: { code: gameCode },
        select: { parameter: true, value: true },
      })
      if (gameDefaults.length > 0) {
        await tx.serverConfig.createMany({
          data: gameDefaults.map((gd: { parameter: string; value: string }) => ({
            serverId,
            parameter: gd.parameter,
            value: gd.value,
          })),
          skipDuplicates: true,
        })
        this.logger.debug(
          `Seeded ${gameDefaults.length} game defaults (${gameCode}) for server ${serverId}`,
        )
      }
    } catch (seedGameError) {
      this.logger.warn(
        `Failed to seed game defaults (${gameCode}) for ${address}:${_port}: ${seedGameError}`,
      )
      // Continue with transaction
    }
  }

  /**
   * Seeds mod-specific configuration defaults within a transaction
   */
  private async seedModDefaults(
    tx: Prisma.TransactionClient,
    serverId: number,
    gameCode: string,
    address: string,
    _port: number,
  ): Promise<void> {
    try {
      const modDefaults = await tx.modDefault.findMany({
        where: { code: gameCode },
        select: { parameter: true, value: true },
      })
      if (modDefaults.length > 0) {
        await tx.serverConfig.createMany({
          data: modDefaults.map((md: { parameter: string; value: string }) => ({
            serverId,
            parameter: md.parameter,
            value: md.value,
          })),
          skipDuplicates: true,
        })
        this.logger.debug(
          `Seeded ${modDefaults.length} mod defaults (${gameCode}) for server ${serverId}`,
        )
      }
    } catch (seedModError) {
      this.logger.warn(
        `Failed to seed mod defaults (${gameCode}) for ${address}:${_port}: ${seedModError}`,
      )
      // Continue with transaction
    }
  }

  /**
   * Enriches server with GeoIP location data (best effort, outside transaction)
   */
  private async enrichServerWithGeoIP(options: GeoEnrichmentOptions): Promise<void> {
    try {
      const { address, serverId, currentCity, currentCountry, currentLat, currentLng } = options

      const ipOnly = address.includes(":") ? address.split(":")[0] : address

      // Skip if already has complete geo data or if not IPv4
      if (
        !ipOnly ||
        (currentCity && currentCountry && currentLat != null && currentLng != null) ||
        isIP(ipOnly) !== 4
      ) {
        return
      }

      const ipNum = ipv4ToBigInt(ipOnly)
      if (ipNum === null) {
        return
      }

      const block = await this.database.prisma.geoLiteCityBlock.findFirst({
        where: { startIpNum: { lte: ipNum }, endIpNum: { gte: ipNum } },
        select: { locId: true },
      })

      if (!block) {
        return
      }

      const location = await this.database.prisma.geoLiteCityLocation.findUnique({
        where: { locId: block.locId },
        select: { city: true, country: true, latitude: true, longitude: true },
      })

      if (!location) {
        return
      }

      await this.database.prisma.server.update({
        where: { serverId },
        data: {
          city: location.city ?? undefined,
          country: location.country ?? undefined,
          lat: location.latitude ? Number(location.latitude) : undefined,
          lng: location.longitude ? Number(location.longitude) : undefined,
        },
      })
    } catch (geoErr) {
      this.logger.warn(
        `Failed to enrich server geo for ${options.address}:${options.port}: ${String(geoErr)}`,
      )
    }
  }

  /**
   * Creates a new server with all configuration seeding in a single transaction
   */
  private async createNewServerWithDefaults(
    address: string,
    port: number,
    gameCode: string,
    serverSelect: Prisma.ServerSelect,
  ): Promise<ServerRecord> {
    return this.database.transaction(async (tx) => {
      // Create the server
      const newServer = await tx.server.create({
        data: {
          game: gameCode,
          address,
          port,
          publicAddress: `${address}:${port}`,
          name: `Server ${address}:${port}`,
          ...INGRESS_CONSTANTS.SERVER_DEFAULTS,
        },
        select: serverSelect,
      })

      const serverId = newServer.serverId

      // Seed all configuration defaults
      await this.seedServerDefaults(tx, serverId, address, port)
      await this.seedGameDefaults(tx, serverId, gameCode, address, port)
      await this.seedModDefaults(tx, serverId, gameCode, address, port)

      return newServer
    })
  }
}

/**
 * Game detector adapter
 */
export class GameDetectorAdapter implements IGameDetector {
  constructor(private readonly gameDetectionService: IGameDetectionService) {}

  async detectGame(
    address: string,
    port: number,
    logSamples: string[],
  ): Promise<GameDetectionResult> {
    return this.gameDetectionService.detectGame(address, port, logSamples)
  }
}

/**
 * Create ingress dependencies from existing services
 */
export function createIngressDependencies(
  database: DatabaseClient,
  serverService: IServerService,
  gameDetectionService: IGameDetectionService,
  logger: ILogger,
  options: { skipAuth?: boolean } = {},
): IngressDependencies {
  return {
    serverAuthenticator: new DatabaseServerAuthenticator(
      database,
      logger,
      options.skipAuth ?? false,
    ),
    gameDetector: new GameDetectorAdapter(gameDetectionService),
    serverInfoProvider: new ServerInfoProviderAdapter(database, serverService, logger),
  }
}
