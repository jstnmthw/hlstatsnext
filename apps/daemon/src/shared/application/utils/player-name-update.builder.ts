/**
 * Player Name Update Builder
 *
 * Provides a fluent interface for building player name statistics updates
 * with proper validation and type safety. Reduces cyclomatic complexity
 * in PlayerRepository.upsertPlayerName by encapsulating conditional field building.
 */

import type { PlayerNameStatsUpdate } from "@/modules/player/types/player.types"
import {
  sanitizePlayerNameStatsUpdate,
  validatePlayerNameStatsUpdate,
} from "@/shared/application/validators/player-name.validator"
import type { Prisma } from "@repo/database/client"

/**
 * Builder class for constructing player name statistics updates
 */
export class PlayerNameUpdateBuilder {
  private updates: PlayerNameStatsUpdate = {}

  /**
   * Adds usage count increment
   */
  addUsage(count: number = 1): PlayerNameUpdateBuilder {
    if (count > 0) {
      this.updates.numUses = (this.updates.numUses || 0) + count
    }
    return this
  }

  /**
   * Adds connection time increment
   */
  addConnectionTime(seconds: number): PlayerNameUpdateBuilder {
    if (seconds > 0) {
      this.updates.connectionTime = (this.updates.connectionTime || 0) + seconds
    }
    return this
  }

  /**
   * Adds kill count increment
   */
  addKills(count: number = 1): PlayerNameUpdateBuilder {
    if (count > 0) {
      this.updates.kills = (this.updates.kills || 0) + count
    }
    return this
  }

  /**
   * Adds death count increment
   */
  addDeaths(count: number = 1): PlayerNameUpdateBuilder {
    if (count > 0) {
      this.updates.deaths = (this.updates.deaths || 0) + count
    }
    return this
  }

  /**
   * Adds suicide count increment
   */
  addSuicides(count: number = 1): PlayerNameUpdateBuilder {
    if (count > 0) {
      this.updates.suicides = (this.updates.suicides || 0) + count
    }
    return this
  }

  /**
   * Adds shot count increment
   */
  addShots(count: number = 1): PlayerNameUpdateBuilder {
    if (count > 0) {
      this.updates.shots = (this.updates.shots || 0) + count
    }
    return this
  }

  /**
   * Adds hit count increment
   */
  addHits(count: number = 1): PlayerNameUpdateBuilder {
    if (count > 0) {
      this.updates.hits = (this.updates.hits || 0) + count
    }
    return this
  }

  /**
   * Adds headshot count increment
   */
  addHeadshots(count: number = 1): PlayerNameUpdateBuilder {
    if (count > 0) {
      this.updates.headshots = (this.updates.headshots || 0) + count
    }
    return this
  }

  /**
   * Updates the last use timestamp
   */
  updateLastUse(timestamp: Date = new Date()): PlayerNameUpdateBuilder {
    this.updates.lastUse = timestamp
    return this
  }

  /**
   * Builds the final update object with validation
   */
  build(): PlayerNameStatsUpdate {
    if (Object.keys(this.updates).length === 0) {
      throw new Error("No updates specified - use builder methods to add updates")
    }

    // Validate the updates
    validatePlayerNameStatsUpdate(this.updates)

    return sanitizePlayerNameStatsUpdate(this.updates)
  }

  /**
   * Builds the update object in the format expected by Prisma upsert operations
   * This separates increment operations from direct value assignments
   */
  buildForPrismaUpsert(): {
    incrementData: Record<string, unknown>
    directData: Record<string, unknown>
  } {
    const incrementData: Record<string, unknown> = {}
    const directData: Record<string, unknown> = {}

    // Build increment operations for numeric fields
    if (this.updates.numUses !== undefined && this.updates.numUses > 0) {
      incrementData.numUses = { increment: this.updates.numUses }
    }

    if (this.updates.connectionTime !== undefined && this.updates.connectionTime > 0) {
      incrementData.connectionTime = { increment: this.updates.connectionTime }
    }

    if (this.updates.kills !== undefined && this.updates.kills > 0) {
      incrementData.kills = { increment: this.updates.kills }
    }

    if (this.updates.deaths !== undefined && this.updates.deaths > 0) {
      incrementData.deaths = { increment: this.updates.deaths }
    }

    if (this.updates.suicides !== undefined && this.updates.suicides > 0) {
      incrementData.suicides = { increment: this.updates.suicides }
    }

    if (this.updates.shots !== undefined && this.updates.shots > 0) {
      incrementData.shots = { increment: this.updates.shots }
    }

    if (this.updates.hits !== undefined && this.updates.hits > 0) {
      incrementData.hits = { increment: this.updates.hits }
    }

    if (this.updates.headshots !== undefined && this.updates.headshots > 0) {
      incrementData.headshots = { increment: this.updates.headshots }
    }

    // Handle direct value assignments
    if (this.updates.lastUse !== undefined) {
      directData.lastUse = this.updates.lastUse
    }

    return { incrementData, directData }
  }

  /**
   * Builds create data for new player name records
   */
  buildForCreate(playerId: number, name: string): Prisma.PlayerNameUncheckedCreateInput {
    return {
      playerId,
      name,
      lastUse: this.updates.lastUse ?? new Date(),
      numUses: this.updates.numUses ?? 0,
      connectionTime: this.updates.connectionTime ?? 0,
      kills: this.updates.kills ?? 0,
      deaths: this.updates.deaths ?? 0,
      suicides: this.updates.suicides ?? 0,
      headshots: this.updates.headshots ?? 0,
      shots: this.updates.shots ?? 0,
      hits: this.updates.hits ?? 0,
    }
  }

  /**
   * Checks if any updates have been added
   */
  hasUpdates(): boolean {
    return Object.keys(this.updates).length > 0
  }

  /**
   * Clears all updates and returns a fresh builder
   */
  clear(): PlayerNameUpdateBuilder {
    this.updates = {}
    return this
  }

  /**
   * Creates a new builder instance
   */
  static create(): PlayerNameUpdateBuilder {
    return new PlayerNameUpdateBuilder()
  }

  /**
   * Creates a builder for a kill event (increments kills and headshots if applicable)
   */
  static forKill(headshot: boolean = false): PlayerNameUpdateBuilder {
    const builder = new PlayerNameUpdateBuilder().addKills(1).updateLastUse()

    if (headshot) {
      builder.addHeadshots(1)
    }

    return builder
  }

  /**
   * Creates a builder for a death event
   */
  static forDeath(): PlayerNameUpdateBuilder {
    return new PlayerNameUpdateBuilder().addDeaths(1).updateLastUse()
  }

  /**
   * Creates a builder for a suicide event
   */
  static forSuicide(): PlayerNameUpdateBuilder {
    return new PlayerNameUpdateBuilder().addSuicides(1).addDeaths(1).updateLastUse()
  }

  /**
   * Creates a builder for a damage event (shots and hits)
   */
  static forDamage(headshot: boolean = false): PlayerNameUpdateBuilder {
    const builder = new PlayerNameUpdateBuilder().addShots(1).addHits(1).updateLastUse()

    if (headshot) {
      builder.addHeadshots(1)
    }

    return builder
  }

  /**
   * Creates a builder for a connect event
   */
  static forConnect(): PlayerNameUpdateBuilder {
    return new PlayerNameUpdateBuilder().addUsage(1).updateLastUse()
  }

  /**
   * Creates a builder for a disconnect event with session duration
   */
  static forDisconnect(sessionDuration: number): PlayerNameUpdateBuilder {
    const builder = new PlayerNameUpdateBuilder().updateLastUse()

    if (sessionDuration > 0) {
      builder.addConnectionTime(sessionDuration)
    }

    return builder
  }
}
