/**
 * Mod Defaults Seeder
 *
 * Seeds mod-specific configuration defaults within a transaction.
 */
import type { ILogger } from "@/shared/utils/logger.types"
import type { Prisma } from "@repo/db/client"

/**
 * Seeds mod-specific configuration defaults within a transaction
 */
export async function seedModDefaults(
  tx: Prisma.TransactionClient,
  serverId: number,
  gameCode: string,
  address: string,
  port: number,
  logger: ILogger,
): Promise<void> {
  try {
    const modDefaults = await tx.modDefault.findMany({
      where: { code: gameCode },
      select: { parameter: true, value: true },
    })
    if (modDefaults.length > 0) {
      await tx.serverConfig.createMany({
        data: modDefaults.map((md: { parameter: string; value: string }) => ({
          serverId,
          parameter: md.parameter,
          value: md.value,
        })),
        skipDuplicates: true,
      })
      logger.debug(`Seeded ${modDefaults.length} mod defaults (${gameCode}) for server ${serverId}`)
    }
  } catch (seedModError) {
    logger.warn(`Failed to seed mod defaults (${gameCode}) for ${address}:${port}: ${seedModError}`)
    // Continue with transaction
  }
}
