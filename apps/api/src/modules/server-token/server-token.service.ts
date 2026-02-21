/**
 * ServerToken Service
 *
 * Handles creation, revocation, and querying of server authentication tokens.
 * Tokens are used by game server plugins to authenticate with the daemon.
 */

import { generateToken, type ICryptoService } from "@repo/crypto"
import { db, type Prisma, type ServerToken } from "@repo/db/client"

export interface CreateTokenInput {
  name: string
  rconPassword?: string
  game: string
  expiresAt?: Date | null
  createdBy: string
}

export interface CreateTokenResult {
  success: boolean
  message: string
  rawToken: string | null
  token: ServerToken | null
}

export interface RevokeTokenResult {
  success: boolean
  message: string
  token: ServerToken | null
}

export interface TokenListOptions {
  includeRevoked?: boolean
  skip?: number
  take?: number
  orderBy?: Prisma.ServerTokenOrderByWithRelationInput
}

export class ServerTokenService {
  constructor(private readonly crypto: ICryptoService) {}

  /**
   * Create a new server token.
   * Returns the raw token only once - it cannot be retrieved again.
   */
  async createToken(input: CreateTokenInput): Promise<CreateTokenResult> {
    try {
      // Generate cryptographically secure token
      const { raw, hash, prefix } = generateToken()

      // Encrypt RCON password if provided
      let encryptedRconPassword = ""
      if (input.rconPassword && input.rconPassword.trim() !== "") {
        encryptedRconPassword = await this.crypto.encrypt(input.rconPassword)
      }

      // Create token record
      const token = await db.serverToken.create({
        data: {
          tokenHash: hash,
          tokenPrefix: prefix,
          name: input.name,
          rconPassword: encryptedRconPassword,
          game: input.game,
          expiresAt: input.expiresAt ?? null,
          createdBy: input.createdBy,
        },
      })

      return {
        success: true,
        message: "Token created successfully",
        rawToken: raw, // Only returned once!
        token,
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to create token: ${error instanceof Error ? error.message : "Unknown error"}`,
        rawToken: null,
        token: null,
      }
    }
  }

  /**
   * Revoke a token by setting its revokedAt timestamp.
   * Revoked tokens cannot authenticate servers.
   */
  async revokeToken(tokenId: number): Promise<RevokeTokenResult> {
    try {
      const existingToken = await db.serverToken.findUnique({
        where: { id: tokenId },
      })

      if (!existingToken) {
        return {
          success: false,
          message: "Token not found",
          token: null,
        }
      }

      if (existingToken.revokedAt) {
        return {
          success: false,
          message: "Token is already revoked",
          token: existingToken,
        }
      }

      const token = await db.serverToken.update({
        where: { id: tokenId },
        data: { revokedAt: new Date() },
      })

      return {
        success: true,
        message: "Token revoked successfully",
        token,
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to revoke token: ${error instanceof Error ? error.message : "Unknown error"}`,
        token: null,
      }
    }
  }

  /**
   * Find tokens with optional filtering.
   */
  async findMany(options: TokenListOptions = {}): Promise<ServerToken[]> {
    const { includeRevoked = false, skip, take, orderBy } = options

    const where: Prisma.ServerTokenWhereInput = includeRevoked ? {} : { revokedAt: null }

    return db.serverToken.findMany({
      where,
      skip,
      take,
      orderBy: orderBy ?? { createdAt: "desc" },
      include: {
        _count: {
          select: { servers: true },
        },
      },
    })
  }

  /**
   * Count tokens with optional filtering.
   */
  async count(includeRevoked = false): Promise<number> {
    const where: Prisma.ServerTokenWhereInput = includeRevoked ? {} : { revokedAt: null }

    return db.serverToken.count({ where })
  }

  /**
   * Find a single token by ID.
   */
  async findById(tokenId: number): Promise<ServerToken | null> {
    return db.serverToken.findUnique({
      where: { id: tokenId },
      include: {
        servers: {
          select: {
            serverId: true,
            name: true,
            address: true,
            port: true,
          },
        },
        _count: {
          select: { servers: true },
        },
      },
    })
  }

  /**
   * Find many tokens using Pothos Prisma plugin query format.
   * Used for relation-aware GraphQL queries.
   */
  async findManyPrisma(args: Prisma.ServerTokenFindManyArgs): Promise<ServerToken[]> {
    return db.serverToken.findMany({
      ...args,
      orderBy: args.orderBy ?? { createdAt: "desc" },
    })
  }

  /**
   * Find a single token by ID using Pothos Prisma plugin query format.
   * Used for relation-aware GraphQL queries.
   */
  async findByIdPrisma(
    tokenId: number,
    query: { include?: Prisma.ServerTokenInclude; select?: Prisma.ServerTokenSelect },
  ): Promise<ServerToken | null> {
    return db.serverToken.findUnique({
      where: { id: tokenId },
      ...query,
    })
  }
}
