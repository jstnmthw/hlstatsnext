/**
 * Notification Configuration Repository
 *
 * Handles database operations for server notification configurations.
 * Provides caching and efficient retrieval of notification settings.
 */

import type { TransactionalPrisma } from "@/database/client"
import type { ILogger } from "@/shared/utils/logger.types"
import type { NotificationConfig, Prisma } from "@repo/db/client"

export interface INotificationConfigRepository {
  /**
   * Get notification configuration for a server
   */
  getConfig(serverId: number): Promise<NotificationConfig | null>

  /**
   * Create or update notification configuration for a server
   */
  upsertConfig(
    serverId: number,
    config: {
      engineType: string
      colorEnabled: boolean
      colorScheme?: Prisma.JsonValue
      eventTypes?: Prisma.JsonValue
      messageFormats?: Prisma.JsonValue
    },
  ): Promise<NotificationConfig>

  /**
   * Delete notification configuration for a server
   */
  deleteConfig(serverId: number): Promise<void>

  /**
   * Check if notification is enabled for specific event type
   */
  isEventTypeEnabled(serverId: number, eventType: string): Promise<boolean>

  /**
   * Clear cached configuration (for testing and config updates)
   */
  clearCache(): void

  /**
   * Clear cached configuration for specific server
   */
  clearServerCache(serverId: number): void

  /**
   * Get configuration with defaults applied
   */
  getConfigWithDefaults(
    serverId: number,
    engineType: string,
  ): Promise<{
    serverId: number
    engineType: string
    colorEnabled: boolean
    colorScheme: Prisma.JsonValue
    eventTypes: string[] | null
    messageFormats: Prisma.JsonValue
  }>
}

export class NotificationConfigRepository implements INotificationConfigRepository {
  private configCache = new Map<number, NotificationConfig | null>()
  private readonly CACHE_TTL = 300000 // 5 minutes
  private cacheTimestamps = new Map<number, number>()

  constructor(
    private readonly db: TransactionalPrisma,
    private readonly logger: ILogger,
  ) {}

  async getConfig(serverId: number): Promise<NotificationConfig | null> {
    // Check cache first
    if (this.isCacheValid(serverId)) {
      return this.configCache.get(serverId) || null
    }

    try {
      const config = await this.db.notificationConfig.findUnique({
        where: { serverId },
      })

      // Cache the result (including null)
      this.configCache.set(serverId, config)
      this.cacheTimestamps.set(serverId, Date.now())

      this.logger.debug(`Retrieved notification config for server ${serverId}`, {
        serverId,
        hasConfig: config !== null,
        engineType: config?.engineType,
        colorEnabled: config?.colorEnabled,
      })

      return config
    } catch (error) {
      this.logger.error(`Failed to get notification config for server ${serverId}`, {
        serverId,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  async upsertConfig(
    serverId: number,
    config: {
      engineType: string
      colorEnabled: boolean
      colorScheme?: Prisma.JsonValue
      eventTypes?: Prisma.JsonValue
      messageFormats?: Prisma.JsonValue
    },
  ): Promise<NotificationConfig> {
    try {
      const result = await this.db.notificationConfig.upsert({
        where: { serverId },
        create: {
          serverId,
          engineType: config.engineType,
          colorEnabled: config.colorEnabled ? 1 : 0,
          colorScheme: config.colorScheme as Prisma.InputJsonValue,
          eventTypes: config.eventTypes as Prisma.InputJsonValue,
          messageFormats: config.messageFormats as Prisma.InputJsonValue,
        },
        update: {
          engineType: config.engineType,
          colorEnabled: config.colorEnabled ? 1 : 0,
          colorScheme: config.colorScheme as Prisma.InputJsonValue,
          eventTypes: config.eventTypes as Prisma.InputJsonValue,
          messageFormats: config.messageFormats as Prisma.InputJsonValue,
        },
      })

      // Update cache
      this.configCache.set(serverId, result)
      this.cacheTimestamps.set(serverId, Date.now())

      this.logger.info(`Upserted notification config for server ${serverId}`, {
        serverId,
        engineType: config.engineType,
        colorEnabled: config.colorEnabled,
      })

      return result
    } catch (error) {
      this.logger.error(`Failed to upsert notification config for server ${serverId}`, {
        serverId,
        config,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  async deleteConfig(serverId: number): Promise<void> {
    try {
      await this.db.notificationConfig.delete({
        where: { serverId },
      })

      // Remove from cache
      this.configCache.delete(serverId)
      this.cacheTimestamps.delete(serverId)

      this.logger.info(`Deleted notification config for server ${serverId}`, {
        serverId,
      })
    } catch (error) {
      this.logger.error(`Failed to delete notification config for server ${serverId}`, {
        serverId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  async isEventTypeEnabled(serverId: number, eventType: string): Promise<boolean> {
    try {
      const config = await this.getConfig(serverId)
      if (!config) {
        // Default to all events enabled if no config
        return true
      }

      if (!config.eventTypes) {
        // Default to all events enabled if no specific types configured
        return true
      }

      // Check if eventTypes is an array and contains the event type
      if (Array.isArray(config.eventTypes)) {
        return config.eventTypes.includes(eventType)
      }

      // If eventTypes is not an array, default to enabled
      return true
    } catch (error) {
      this.logger.warn(`Failed to check event type enabled for server ${serverId}`, {
        serverId,
        eventType,
        error: error instanceof Error ? error.message : String(error),
      })
      // Default to enabled on error
      return true
    }
  }

  clearCache(): void {
    this.configCache.clear()
    this.cacheTimestamps.clear()
    this.logger.debug("Cleared notification config cache")
  }

  clearServerCache(serverId: number): void {
    this.configCache.delete(serverId)
    this.cacheTimestamps.delete(serverId)
    this.logger.debug(`Cleared notification config cache for server ${serverId}`, {
      serverId,
    })
  }

  /**
   * Check if cached config is still valid
   */
  private isCacheValid(serverId: number): boolean {
    if (!this.configCache.has(serverId)) {
      return false
    }

    const timestamp = this.cacheTimestamps.get(serverId)
    if (!timestamp) {
      return false
    }

    return Date.now() - timestamp < this.CACHE_TTL
  }

  /**
   * Create default configuration for a server
   */
  static createDefaultConfig(serverId: number, engineType: string) {
    return {
      serverId,
      engineType,
      colorEnabled: false,
      colorScheme: null,
      eventTypes: null, // null means all events are enabled
      messageFormats: null, // null means use default templates
    }
  }

  /**
   * Get configuration with defaults applied
   */
  async getConfigWithDefaults(
    serverId: number,
    engineType: string,
  ): Promise<{
    serverId: number
    engineType: string
    colorEnabled: boolean
    colorScheme: Prisma.JsonValue
    eventTypes: string[] | null
    messageFormats: Prisma.JsonValue
  }> {
    const config = await this.getConfig(serverId)

    if (!config) {
      return {
        serverId,
        engineType,
        colorEnabled: false,
        colorScheme: null,
        eventTypes: null,
        messageFormats: null,
      }
    }

    return {
      serverId: config.serverId,
      engineType: config.engineType,
      colorEnabled: Boolean(config.colorEnabled),
      colorScheme: config.colorScheme,
      eventTypes: Array.isArray(config.eventTypes) ? (config.eventTypes as string[]) : null,
      messageFormats: config.messageFormats,
    }
  }
}
