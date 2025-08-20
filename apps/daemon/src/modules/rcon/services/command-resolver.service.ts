/**
 * Database-Driven RCON Command Resolver
 * 
 * Resolves RCON commands using the same database-driven approach as legacy HLStatsX:
 * 1. Server-specific config (servers_config)
 * 2. MOD-specific defaults (mods_defaults) 
 * 3. Global defaults (servers_config_default)
 * 4. Hard fallback ("say")
 */

import type { ILogger } from "@/shared/utils/logger.types"
import type { IServerRepository } from "@/modules/server/server.types"

export type CommandType = 
  | 'BroadCastEventsCommand'
  | 'PlayerEventsCommand' 
  | 'BroadCastEventsCommandAnnounce'
  | 'PlayerEventsCommandOSD'
  | 'PlayerEventsCommandHint'
  | 'PlayerEventsAdminCommand'

export interface CommandCapabilities {
  supportsBatch: boolean
  maxBatchSize: number
  requiresHashPrefix: boolean
}

export class CommandResolverService {
  private readonly commandCache = new Map<string, string>()
  private readonly capabilitiesCache = new Map<string, CommandCapabilities>()

  constructor(
    private readonly serverRepository: IServerRepository,
    private readonly logger: ILogger,
  ) {}

  /**
   * Get the appropriate RCON command for a server and command type
   * Uses legacy HLStatsX priority: server_config -> mods_defaults -> servers_config_default -> fallback
   */
  async getCommand(serverId: number, commandType: CommandType): Promise<string> {
    const cacheKey = `${serverId}:${commandType}`
    
    // Check cache first
    if (this.commandCache.has(cacheKey)) {
      return this.commandCache.get(cacheKey)!
    }

    try {
      // 1. Check server-specific configuration first
      const serverCommand = await this.serverRepository.getServerConfig(serverId, commandType)
      if (serverCommand && serverCommand.trim() !== '') {
        this.commandCache.set(cacheKey, serverCommand)
        return serverCommand
      }

      // 2. Get server's MOD type and check MOD defaults
      const serverModType = await this.serverRepository.getServerConfig(serverId, 'Mod')
      if (serverModType && serverModType.trim() !== '') {
        const modCommand = await this.serverRepository.getModDefault(serverModType, commandType)
        if (modCommand && modCommand.trim() !== '') {
          this.commandCache.set(cacheKey, modCommand)
          return modCommand
        }
      }

      // 3. Check global default configuration
      const globalCommand = await this.serverRepository.getServerConfigDefault(commandType)
      if (globalCommand && globalCommand.trim() !== '') {
        this.commandCache.set(cacheKey, globalCommand)
        return globalCommand
      }

      // 4. Hard fallback to vanilla "say" command
      const fallback = 'say'
      this.commandCache.set(cacheKey, fallback)
      
      this.logger.debug(`Using fallback command for server ${serverId}`, {
        serverId,
        commandType,
        command: fallback
      })
      
      return fallback

    } catch (error) {
      this.logger.error(`Failed to resolve command for server ${serverId}`, {
        serverId,
        commandType,
        error: error instanceof Error ? error.message : String(error)
      })
      
      // Return safe fallback on error
      return 'say'
    }
  }

  /**
   * Get command capabilities based on the resolved command
   */
  async getCommandCapabilities(serverId: number, commandType: CommandType): Promise<CommandCapabilities> {
    const cacheKey = `caps:${serverId}:${commandType}`
    
    if (this.capabilitiesCache.has(cacheKey)) {
      return this.capabilitiesCache.get(cacheKey)!
    }

    const command = await this.getCommand(serverId, commandType)
    const capabilities = this.determineCapabilities(command)
    
    this.capabilitiesCache.set(cacheKey, capabilities)
    return capabilities
  }

  /**
   * Check if server supports batch messaging for this command type
   */
  async supportsBatch(serverId: number, commandType: CommandType): Promise<boolean> {
    const capabilities = await this.getCommandCapabilities(serverId, commandType)
    return capabilities.supportsBatch
  }

  /**
   * Get maximum batch size for server's command
   */
  async getBatchLimit(serverId: number, commandType: CommandType): Promise<number> {
    const capabilities = await this.getCommandCapabilities(serverId, commandType)
    return capabilities.maxBatchSize
  }

  /**
   * Determine command capabilities based on the command string
   */
  private determineCapabilities(command: string): CommandCapabilities {
    // Analyze command to determine capabilities
    if (command.includes('hlx_amx_bulkpsay')) {
      return {
        supportsBatch: true,
        maxBatchSize: 8,
        requiresHashPrefix: true
      }
    }

    if (command.includes('hlx_sm_psay')) {
      return {
        supportsBatch: true,
        maxBatchSize: 32, // SourceMod supports comma-separated lists
        requiresHashPrefix: false
      }
    }

    if (command.includes('hlx_amx_psay') || command.includes('ms_psay') || command.includes('hlx_psay') || command.includes('ma_hlx_psay')) {
      return {
        supportsBatch: false, // Individual commands only
        maxBatchSize: 1,
        requiresHashPrefix: command.includes('amx') // AMX commands typically need #
      }
    }

    // Vanilla "say" or unknown commands
    return {
      supportsBatch: false,
      maxBatchSize: 1,
      requiresHashPrefix: false
    }
  }

  /**
   * Clear the command cache (useful for testing or config changes)
   */
  clearCache(): void {
    this.commandCache.clear()
    this.capabilitiesCache.clear()
  }

  /**
   * Clear cache for a specific server (when server config changes)
   */
  clearServerCache(serverId: number): void {
    for (const key of this.commandCache.keys()) {
      if (key.startsWith(`${serverId}:`)) {
        this.commandCache.delete(key)
      }
    }
    for (const key of this.capabilitiesCache.keys()) {
      if (key.startsWith(`caps:${serverId}:`)) {
        this.capabilitiesCache.delete(key)
      }
    }
  }
}