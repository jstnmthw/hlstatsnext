/**
 * Map Resolver
 *
 * Resolves current map context for action handlers using RCON service as single source of truth.
 * This utility provides real-time map information directly from game servers via RCON,
 * ensuring accuracy over potentially delayed log events.
 *
 * RCON service provides authoritative, real-time server state including current map,
 * making it more reliable than log-based events which can be delayed or out of order.
 *
 * @example Basic Usage
 * ```typescript
 * const resolver = new MapResolver(rconService)
 *
 * const currentMap = await resolver.resolveCurrentMap(serverId)
 * // Returns: "de_dust2" | "" (if RCON unavailable)
 * ```
 *
 * @example Without RCON Service
 * ```typescript
 * const resolver = new MapResolver(undefined) // No RCON service
 *
 * const currentMap = await resolver.resolveCurrentMap(serverId)
 * // Always returns: "" (fallback)
 * ```
 *
 * @example Real-time Map Data
 * ```typescript
 * // Gets current map directly from game server via RCON
 * const currentMap = await resolver.resolveCurrentMap(serverId)
 * // Always reflects actual server state, not cached/delayed data
 * ```
 */

import type { IRconService } from "@/modules/rcon/rcon.types"

export class MapResolver {
  constructor(private readonly rconService: IRconService | undefined) {}

  async resolveCurrentMap(serverId: number): Promise<string> {
    if (!this.rconService) {
      return ""
    }

    try {
      const status = await this.rconService.getStatus(serverId)
      return status.map || ""
    } catch {
      // RCON failure - return empty string as fallback
      // This is logged at the RCON service level, no need to duplicate logging here
      return ""
    }
  }
}
