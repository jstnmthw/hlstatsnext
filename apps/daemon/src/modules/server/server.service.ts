import type { ILogger } from "@/shared/utils/logger.types"
import type { IServerRepository, IServerService, ServerInfo } from "./server.types"

export class ServerService implements IServerService {
  // IgnoreBots and similar per-server flags are read on hot event paths (every
  // bot-involved kill/damage). Cache config reads briefly so a busy bot server
  // doesn't query the DB per event; staleness is bounded by the TTL, which is
  // acceptable for rarely-changed admin settings. Keyed by serverId:parameter,
  // so the map is bounded by (servers × parameters) and entries refresh in place.
  private static readonly CONFIG_CACHE_TTL_MS = 30_000
  private static readonly IGNORE_BOTS_DEFAULT = false
  private readonly configCache = new Map<string, { value: string | null; expiresAt: number }>()

  // A server's game is set at registration and effectively immutable, yet
  // getServerGame is read on essentially every player/match event. Cache it
  // unbounded (bounded by server count) and invalidate per-server on shutdown
  // via clearServerCache so a re-registered server is re-read fresh.
  private readonly gameCache = new Map<number, string>()

  constructor(
    private readonly repository: IServerRepository,
    private readonly logger: ILogger,
  ) {}

  async findById(serverId: number): Promise<ServerInfo | null> {
    return await this.repository.findById(serverId)
  }

  async getServer(serverId: number): Promise<ServerInfo | null> {
    return await this.repository.findById(serverId)
  }

  async getServerByAddress(address: string, port: number): Promise<ServerInfo | null> {
    return await this.repository.findByAddress(address, port)
  }

  async getServerGame(serverId: number): Promise<string> {
    const cached = this.gameCache.get(serverId)
    if (cached !== undefined) {
      return cached
    }

    const server = await this.repository.findById(serverId)

    if (!server) {
      // Don't cache the miss — an unregistered server may appear later.
      this.logger.warn(`Server ${serverId} not found, defaulting to unknown game type`)
      return "unknown"
    }

    this.gameCache.set(serverId, server.game)
    return server.game
  }

  // Drop all cached state for a server on SERVER_SHUTDOWN/removal so a
  // re-registered server (or one whose game/config changed while offline) is
  // re-read fresh. Wired into the ServerLifecycleCoordinator fan-out.
  clearServerCache(serverId: number): void {
    this.gameCache.delete(serverId)
    const prefix = `${serverId}:`
    for (const key of this.configCache.keys()) {
      if (key.startsWith(prefix)) {
        this.configCache.delete(key)
      }
    }
  }

  async getServerConfigBoolean(
    serverId: number,
    parameter: string,
    fallback: boolean,
  ): Promise<boolean> {
    const raw = await this.readServerConfigCached(serverId, parameter)
    if (raw == null) return fallback
    const normalized = raw.trim().toLowerCase()
    if (["1", "true", "yes", "on"].includes(normalized)) return true
    if (["0", "false", "no", "off"].includes(normalized)) return false
    return fallback
  }

  // Single source of truth for the per-server IgnoreBots flag. Scoring, presence,
  // session sync, and player-count enrichment all read it through here so they can
  // never disagree about whether bots count. The last-resort fallback matches the
  // seeded servers_config_default row (IgnoreBots='0'), so an unseeded DB behaves
  // identically to a seeded one rather than silently flipping the default.
  async isIgnoreBotsEnabled(serverId: number): Promise<boolean> {
    return this.getServerConfigBoolean(serverId, "IgnoreBots", ServerService.IGNORE_BOTS_DEFAULT)
  }

  private async readServerConfigCached(
    serverId: number,
    parameter: string,
  ): Promise<string | null> {
    const key = `${serverId}:${parameter}`
    const now = Date.now()
    const cached = this.configCache.get(key)
    if (cached && cached.expiresAt > now) {
      return cached.value
    }

    const value = await this.repository.getServerConfig(serverId, parameter)
    this.configCache.set(key, {
      value,
      expiresAt: now + ServerService.CONFIG_CACHE_TTL_MS,
    })
    return value
  }

  async hasRconCredentials(serverId: number): Promise<boolean> {
    return await this.repository.hasRconCredentials(serverId)
  }

  async findActiveServersWithRcon(maxAgeMinutes?: number): Promise<ServerInfo[]> {
    return await this.repository.findActiveServersWithRcon(maxAgeMinutes)
  }

  async findServersByIds(serverIds: number[]): Promise<ServerInfo[]> {
    return await this.repository.findServersByIds(serverIds)
  }

  async findAllServersWithRcon(): Promise<ServerInfo[]> {
    return await this.repository.findAllServersWithRcon()
  }

  async getServerConfig(serverId: number, parameter: string): Promise<string | null> {
    return await this.repository.getServerConfig(serverId, parameter)
  }

  async getServerModType(serverId: number): Promise<string> {
    try {
      const modConfig = await this.repository.getServerConfig(serverId, "Mod")

      // Return the configured MOD type, defaulting to empty string if null
      if (!modConfig || modConfig.trim() === "") {
        return ""
      }

      return modConfig.trim().toUpperCase()
    } catch (error) {
      this.logger.error(`Failed to get MOD type for server ${serverId}: ${error}`)
      return ""
    }
  }
}
