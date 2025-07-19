import { db } from "./client"
import { logError, logInfo, logStep, logSuccess } from "./seeders/fake/logger"
import { logDatabaseStats } from "./seeders"

/**
 * Reset development data from the database.
 * This script clears out data that was added during development/testing
 * while preserving the initial seeded data (Games, Countries).
 */
async function resetDatabase() {
  logStep("Starting database reset...")
  logInfo("This will clear development data while preserving initial seeded data.")

  try {
    const beforeStats = await logDatabaseStats("Current database statistics:")

    // Check only resettable stats (ignore first 2: Games, Countries)
    if (beforeStats.slice(2).every((count: number) => count === 0)) {
      logSuccess("Database is already clean - no development data to reset.")
      return
    }

    const startTime = Date.now()

    logStep("Step 1: Clearing player-related data...")
    await db.playerUniqueId.deleteMany()
    await db.player.deleteMany()

    logStep("Step 2: Clearing community and server data...")
    await db.clan.deleteMany()
    await db.serverConfig.deleteMany()
    await db.server.deleteMany()

    // logStep("Step 3: Clearing game-specific definitions...");
    // await db.team.deleteMany();
    // await db.weapon.deleteMany();
    // await db.action.deleteMany();
    // await db.rank.deleteMany();
    // await db.award.deleteMany();

    const duration = Math.round((Date.now() - startTime) / 1000)
    logSuccess(`Database reset completed successfully in ${duration}s!`)

    await logDatabaseStats("Final database statistics:")
  } catch (error) {
    logError("Database reset failed:")
    console.error(error)
    throw error
  }
}

const main = async (): Promise<void> => {
  try {
    logStep("Resetting database...")
    await resetDatabase()
  } catch (error) {
    logError("Reset failed with unhandled error:")
    console.error(error)
    process.exit(1)
  } finally {
    await db.$disconnect()
  }
}

main()
