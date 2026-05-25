/**
 * Player Name Repository
 *
 * Owns upserts and aggregate stat tracking for the `players_names`
 * (alias) table.
 */

import type { DatabaseClient } from "@/database/client"
import { PlayerNameUpdateBuilder } from "@/shared/application/utils/player-name-update.builder"
import { BaseRepository } from "@/shared/infrastructure/persistence/repository.base"
import type { UpdateOptions } from "@/shared/types/database"
import type { ILogger } from "@/shared/utils/logger.types"
import type { PlayerName } from "@repo/db/client"
import type { PlayerNameStatsUpdate } from "../types/player.types"

export class PlayerNameRepository extends BaseRepository<PlayerName & Record<string, unknown>> {
  protected tableName = "playerName"

  constructor(db: DatabaseClient, logger: ILogger) {
    super(db, logger)
  }

  async upsertPlayerName(
    playerId: number,
    name: string,
    updates: PlayerNameStatsUpdate,
    options?: UpdateOptions,
  ): Promise<void> {
    try {
      this.validateId(playerId, "upsertPlayerName")
      if (!name || name.trim().length === 0) {
        throw new Error("name is required for upsertPlayerName")
      }

      const builder = PlayerNameUpdateBuilder.create()

      if (updates.numUses) builder.addUsage(updates.numUses)
      if (updates.connectionTime) builder.addConnectionTime(updates.connectionTime)
      if (updates.kills) builder.addKills(updates.kills)
      if (updates.deaths) builder.addDeaths(updates.deaths)
      if (updates.suicides) builder.addSuicides(updates.suicides)
      if (updates.shots) builder.addShots(updates.shots)
      if (updates.hits) builder.addHits(updates.hits)
      if (updates.headshots) builder.addHeadshots(updates.headshots)
      if (updates.lastUse) builder.updateLastUse(updates.lastUse)

      const { incrementData, directData } = builder.buildForPrismaUpsert()
      const createData = builder.buildForCreate(playerId, name)

      await this.executeWithTransaction(async (client) => {
        await client.playerName.upsert({
          where: {
            playerId_name: {
              playerId,
              name,
            },
          },
          create: createData,
          update: {
            ...incrementData,
            ...directData,
          },
        })
      }, options)

      this.logger.debug(
        `Upserted PlayerName for player ${playerId} name "${name}" with updates ${JSON.stringify(
          updates,
        )}`,
      )
    } catch (error) {
      this.handleError("upsertPlayerName", error)
    }
  }
}
