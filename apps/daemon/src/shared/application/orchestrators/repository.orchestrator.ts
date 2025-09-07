/**
 * Repository Orchestrator
 *
 * Centralizes the instantiation of all repository classes with their
 * required dependencies in a consistent, testable manner.
 */

import type { DatabaseClient } from "@/database/client"
import type { ILogger } from "@/shared/utils/logger.types"
import type { ICryptoService } from "@repo/crypto"

import { PlayerRepository } from "@/modules/player/player.repository"
import { MatchRepository } from "@/modules/match/match.repository"
import { WeaponRepository } from "@/modules/weapon/weapon.repository"
import { ActionRepository } from "@/modules/action/action.repository"
import { ServerRepository } from "@/modules/server/server.repository"
import { RconRepository } from "@/modules/rcon/rcon.repository"

export interface RepositoryCollection {
  playerRepository: PlayerRepository
  matchRepository: MatchRepository
  weaponRepository: WeaponRepository
  actionRepository: ActionRepository
  serverRepository: ServerRepository
  rconRepository: RconRepository
}

/**
 * Creates all repository instances with standardized dependency injection
 *
 * @param database - Database client instance
 * @param logger - Logger instance
 * @param crypto - Crypto service instance
 * @returns Collection of all repository instances
 */
export function createRepositories(
  database: DatabaseClient,
  logger: ILogger,
  crypto: ICryptoService,
): RepositoryCollection {
  const playerRepository = new PlayerRepository(database, logger)
  const matchRepository = new MatchRepository(database, logger)
  const weaponRepository = new WeaponRepository(database, logger)
  const actionRepository = new ActionRepository(database, logger)
  const serverRepository = new ServerRepository(database, logger)
  const rconRepository = new RconRepository(database, logger, crypto)

  return {
    playerRepository,
    matchRepository,
    weaponRepository,
    actionRepository,
    serverRepository,
    rconRepository,
  }
}
