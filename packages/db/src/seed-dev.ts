import { db } from "./client"
import {
  getSeedConfig,
  logDatabaseStats,
  seedClans,
  seedPlayers,
  seedPlayerUniqueIds,
  seedServers,
} from "./seeders"
import { log, logDivider, logError, logHeader, logStep, logSuccess } from "./seeders/fake/logger"

async function main() {
  const config = getSeedConfig()
  const env = process.env.NODE_ENV || "development"

  logHeader("HLStatsNext Development Seeder")
  log(`  Environment: ${env}`)
  log(
    `  Config: ${config.clans.count} clans, ${config.players.count} players, ${config.servers.count} servers`,
  )

  const startTime = Date.now()

  try {
    logStep("Seeding servers...")
    await seedServers()

    logStep("Seeding clans...")
    await seedClans()

    logStep("Seeding players...")
    await seedPlayers()

    logStep("Seeding player unique IDs...")
    await seedPlayerUniqueIds()

    const duration = Math.round((Date.now() - startTime) / 1000)

    logDivider()
    logSuccess(`Completed in ${duration}s`)
    console.log()

    await logDatabaseStats("Database statistics:")
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
