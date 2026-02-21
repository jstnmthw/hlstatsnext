/**
 * Token Repository Interface
 *
 * Defines the contract for server token data access.
 * Implementations may cache tokens and debounce lastUsedAt updates.
 */

import type { ServerTokenEntity, TokenValidationResult } from "../entities"

/**
 * Repository interface for server token operations.
 */
export interface ITokenRepository {
  /**
   * Find and validate a token by its hash.
   * Returns validation result including revocation and expiry checks.
   *
   * @param tokenHash - SHA-256 hash of the raw token
   */
  findByHash(tokenHash: string): Promise<TokenValidationResult>

  /**
   * Update the lastUsedAt timestamp for a token.
   * Implementations should debounce this to avoid excessive writes.
   *
   * @param tokenId - The token's database ID
   */
  updateLastUsed(tokenId: number): Promise<void>

  /**
   * Find a token by its database ID.
   * Used for refreshing cached token data.
   *
   * @param id - The token's database ID
   */
  findById(id: number): Promise<ServerTokenEntity | null>
}

/**
 * Configuration for token repository behavior.
 */
export interface TokenRepositoryConfig {
  /**
   * Minimum interval between lastUsedAt DB writes per token (ms).
   * Default: 300000 (5 minutes)
   */
  lastUsedDebounceMsDefault: number
}

export const DEFAULT_TOKEN_REPOSITORY_CONFIG: TokenRepositoryConfig = {
  lastUsedDebounceMsDefault: 300_000, // 5 minutes
}
