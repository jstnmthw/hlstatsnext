/**
 * Prisma Token Repository
 *
 * Database implementation of ITokenRepository using Prisma.
 * Includes debounced lastUsedAt updates to minimize DB writes.
 */

import type { DatabaseClient } from "@/database/client"
import type { ILogger } from "@/shared/utils/logger.types"
import type { ServerTokenEntity, TokenValidationResult } from "../entities"
import type { ITokenRepository, TokenRepositoryConfig } from "./token.repository"
import { DEFAULT_TOKEN_REPOSITORY_CONFIG } from "./token.repository"

/**
 * Prisma-based token repository with debounced lastUsedAt tracking.
 */
export class PrismaTokenRepository implements ITokenRepository {
  /**
   * Tracks last DB write time per token to debounce lastUsedAt updates.
   * Key: tokenId, Value: timestamp of last DB write (Date.now())
   */
  private readonly lastUsedWriteTimestamps = new Map<number, number>()

  private readonly config: TokenRepositoryConfig

  constructor(
    private readonly database: DatabaseClient,
    private readonly logger: ILogger,
    config?: Partial<TokenRepositoryConfig>,
  ) {
    this.config = { ...DEFAULT_TOKEN_REPOSITORY_CONFIG, ...config }
  }

  async findByHash(tokenHash: string): Promise<TokenValidationResult> {
    try {
      const dbToken = await this.database.prisma.serverToken.findUnique({
        where: { tokenHash },
      })

      if (!dbToken) {
        return { kind: "not_found" }
      }

      const tokenEntity = this.mapToEntity(dbToken)

      // Check revocation
      if (dbToken.revokedAt !== null) {
        this.logger.debug(`Token ${dbToken.tokenPrefix} is revoked`)
        return { kind: "revoked", tokenPrefix: dbToken.tokenPrefix }
      }

      // Check expiry
      if (dbToken.expiresAt !== null && dbToken.expiresAt < new Date()) {
        this.logger.debug(`Token ${dbToken.tokenPrefix} is expired`)
        return { kind: "expired", tokenPrefix: dbToken.tokenPrefix }
      }

      return { kind: "valid", token: tokenEntity }
    } catch (error) {
      this.logger.error(`Failed to find token by hash: ${error}`)
      throw new Error(`Token lookup failed: ${error}`)
    }
  }

  async updateLastUsed(tokenId: number): Promise<void> {
    const now = Date.now()
    const lastWrite = this.lastUsedWriteTimestamps.get(tokenId) ?? 0
    const elapsed = now - lastWrite

    // Debounce: skip if last write was within the configured interval
    if (elapsed < this.config.lastUsedDebounceMsDefault) {
      this.logger.debug(
        `Debouncing lastUsedAt update for token ${tokenId} (${elapsed}ms < ${this.config.lastUsedDebounceMsDefault}ms)`,
      )
      return
    }

    try {
      await this.database.prisma.serverToken.update({
        where: { id: tokenId },
        data: { lastUsedAt: new Date() },
      })

      this.lastUsedWriteTimestamps.set(tokenId, now)
      this.logger.debug(`Updated lastUsedAt for token ${tokenId}`)
    } catch (error) {
      // Non-fatal: don't throw on lastUsedAt update failure
      this.logger.warn(`Failed to update lastUsedAt for token ${tokenId}: ${error}`)
    }
  }

  async findById(id: number): Promise<ServerTokenEntity | null> {
    try {
      const dbToken = await this.database.prisma.serverToken.findUnique({
        where: { id },
      })

      if (!dbToken) {
        return null
      }

      return this.mapToEntity(dbToken)
    } catch (error) {
      this.logger.error(`Failed to find token by ID ${id}: ${error}`)
      throw new Error(`Token lookup by ID failed: ${error}`)
    }
  }

  /**
   * Clear debounce tracking for a specific token (useful for testing).
   */
  clearDebounceState(tokenId?: number): void {
    if (tokenId !== undefined) {
      this.lastUsedWriteTimestamps.delete(tokenId)
    } else {
      this.lastUsedWriteTimestamps.clear()
    }
  }

  /**
   * Map Prisma ServerToken to domain entity.
   */
  private mapToEntity(
    dbToken: Awaited<ReturnType<typeof this.database.prisma.serverToken.findUnique>> & object,
  ): ServerTokenEntity {
    return {
      id: dbToken.id,
      tokenHash: dbToken.tokenHash,
      tokenPrefix: dbToken.tokenPrefix,
      name: dbToken.name,
      rconPassword: dbToken.rconPassword,
      game: dbToken.game,
      createdAt: dbToken.createdAt,
      expiresAt: dbToken.expiresAt,
      revokedAt: dbToken.revokedAt,
      lastUsedAt: dbToken.lastUsedAt,
      createdBy: dbToken.createdBy,
    }
  }
}
