/**
 * Server Defaults Seeder
 *
 * Seeds server configuration defaults within a transaction.
 */
import type { Prisma } from "@repo/database/client"
import type { ILogger } from "@/shared/utils/logger.types"

/**
 * Seeds server configuration defaults within a transaction
 */
export async function seedServerDefaults(
  tx: Prisma.TransactionClient,
  serverId: number,
  address: string,
  port: number,
  logger: ILogger,
): Promise<void> {
  try {
    const defaults = await tx.serverConfigDefault.findMany()
    if (defaults.length > 0) {
      await tx.serverConfig.createMany({
        data: defaults.map((d) => ({
          serverId,
          parameter: d.parameter,
          value: d.value,
        })),
        skipDuplicates: true,
      })
      logger.debug(`Seeded ${defaults.length} server config defaults for server ${serverId}`)
    }
  } catch (seedError) {
    logger.warn(`Failed to seed server config defaults for ${address}:${port}: ${seedError}`)
    // Continue with transaction - seeding failures shouldn't fail server creation
  }
}
