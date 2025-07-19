import { db } from "../../client"
import { log, logInfo } from "./logger"

/**
 * A comprehensive stat logger for use in seed and reset scripts.
 * It queries and logs counts for all seeded tables.
 * @param title The title to display before the stats.
 * @returns An array of the counts in a predefined order.
 */
export async function logDatabaseStats(title: string) {
  logInfo(title)

  const stats = await Promise.all([
    // Core data (preserved on reset)
    db.game.count(),
    db.country.count(),
    // Generated data (cleared on reset)
    db.clan.count(),
    db.player.count(),
    db.playerUniqueId.count(),
    db.server.count(),
    db.serverConfig.count(),
    db.team.count(),
    db.weapon.count(),
    db.action.count(),
    db.rank.count(),
    db.award.count(),
  ])

  const labels = [
    "Games",
    "Countries",
    "Clans",
    "Players",
    "Player Unique IDs",
    "Servers",
    "Server Configs",
    "Teams",
    "Weapons",
    "Actions",
    "Ranks",
    "Awards",
  ]

  labels.forEach((label, index) => {
    log(`  ${label}: ${stats[index]}`)
  })

  return stats
}
