import { db } from "./client"
import {
  seedClans,
  seedPlayers,
  seedPlayerUniqueIds,
  getSeedConfig,
  seedServers,
  logDatabaseStats,
  seedActions,
} from "./seeders"
import { log, logError, logStep, logSuccess, logInfo } from "./seeders/fake/logger"

async function main() {
  logStep("🌱 Starting database seeding...")

  // Show current configuration
  const config = getSeedConfig()
  const env = process.env.NODE_ENV || "development"
  logInfo(`Using ${env} configuration:`)
  log(`  Clans: ${config.clans.count}`)
  log(`  Players: ${config.players.count}`)
  log(
    `  Multi-game players: ${Math.round(config.playerUniqueIds.multiGamePlayersPercentage * 100)}%`,
  )
  log(`  Servers: ${config.servers.count}`)

  try {
    const startTime = Date.now()

    // Seed in dependency order
    logStep("Step 1: Seeding core data (Games, Countries)...")
    // await seedGames();
    // await seedCountries();

    logStep("Step 2: Seeding game-specific data (Servers, Teams, etc.)...")
    await seedServers()
    // await seedTeams();
    // await seedWeapons();
    await seedActions()
    // await seedRanks();
    // await seedAwards();

    logStep("Step 3: Seeding community data (Clans, Players)...")
    await seedClans()
    await seedPlayers()
    await seedPlayerUniqueIds()

    const duration = Math.round((Date.now() - startTime) / 1000)
    logSuccess(`Database seeding completed successfully in ${duration}s!`)

    // Show final stats
    await logDatabaseStats("Final database statistics:")
  } catch (error) {
    logError("Seeding failed:")
    console.error(error)
    throw error
  }
}

main()
  .catch((e) => {
    logError("Seeding failed with unhandled error.")
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
