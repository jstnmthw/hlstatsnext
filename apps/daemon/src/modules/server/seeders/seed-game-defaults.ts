/**
 * Game Defaults Seeder
 *
 * Seeds game-specific configuration defaults within a transaction.
 */
import type { ILogger } from "@/shared/utils/logger.types"
import type { Prisma } from "@repo/db/client"

/**
 * Seeds game-specific configuration defaults within a transaction
 */
export async function seedGameDefaults(
  tx: Prisma.TransactionClient,
  serverId: number,
  gameCode: string,
  address: string,
  port: number,
  logger: ILogger,
): Promise<void> {
  try {
    const gameDefaults = await tx.gameDefault.findMany({
      where: { code: gameCode },
      select: { parameter: true, value: true },
    })
    if (gameDefaults.length > 0) {
      await tx.serverConfig.createMany({
        data: gameDefaults.map((gd: { parameter: string; value: string }) => ({
          serverId,
          parameter: gd.parameter,
          value: gd.value,
        })),
        skipDuplicates: true,
      })
      logger.debug(
        `Seeded ${gameDefaults.length} game defaults (${gameCode}) for server ${serverId}`,
      )
    }
  } catch (seedGameError) {
    logger.warn(
      `Failed to seed game defaults (${gameCode}) for ${address}:${port}: ${seedGameError}`,
    )
    // Continue with transaction
  }
}
