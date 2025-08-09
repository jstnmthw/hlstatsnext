/**
 * Options Service
 *
 * Read-only accessor for Options and Options_Choices with simple parsing helpers.
 */

import type { DatabaseClient } from "@/database/client"
import type { ILogger } from "@/shared/utils/logger.types"

export interface OptionsCacheEntry<T = string> {
  value: T
  fetchedAt: number
}

export class OptionsService {
  private cache = new Map<string, OptionsCacheEntry>()
  private readonly defaultTtlMs: number

  constructor(
    private readonly database: DatabaseClient,
    private readonly logger: ILogger,
    options?: { ttlMs?: number },
  ) {
    this.defaultTtlMs = options?.ttlMs ?? 60_000
  }

  async get(key: string): Promise<string | null> {
    const now = Date.now()
    const cached = this.cache.get(key)
    if (cached && now - cached.fetchedAt < this.defaultTtlMs) {
      return cached.value
    }

    try {
      const row = await this.database.prisma.option.findUnique({ where: { keyname: key } })
      if (!row) return null
      this.cache.set(key, { value: row.value, fetchedAt: now })
      return row.value
    } catch (error) {
      this.logger.error(`OptionsService.get failed for key=${key}: ${String(error)}`)
      return null
    }
  }

  async getNumber(key: string, fallback: number): Promise<number> {
    const raw = await this.get(key)
    if (raw == null) return fallback
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  async getBoolean(key: string, fallback: boolean): Promise<boolean> {
    const raw = await this.get(key)
    if (raw == null) return fallback
    const normalized = raw.trim().toLowerCase()
    if (["1", "true", "yes", "on"].includes(normalized)) return true
    if (["0", "false", "no", "off"].includes(normalized)) return false
    return fallback
  }
}
