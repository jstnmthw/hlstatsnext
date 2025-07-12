import { db, Prisma } from "../client"
import { getSeedConfig } from "./config"
import { generateSteamId } from "./utils"
import { log } from "./logger"
import { faker } from "@faker-js/faker"

export async function seedPlayerUniqueIds() {
  const config = getSeedConfig()
  const players = await db.player.findMany()
  const games = await db.game.findMany()

  if (players.length === 0 || games.length === 0) {
    throw new Error("Players and Games must be seeded first.")
  }

  const uniqueIds: Prisma.PlayerUniqueIdCreateManyInput[] = []
  const multiGamePlayerCount = Math.floor(
    players.length * config.playerUniqueIds.multiGamePlayersPercentage,
  )

  for (const player of players) {
    // Each player gets at least one ID for their primary game
    uniqueIds.push({
      playerId: player.playerId,
      uniqueId: generateSteamId(),
      game: player.game,
    })
  }

  // Assign additional game IDs to a subset of players
  const multiGamePlayers = faker.helpers.shuffle(players).slice(0, multiGamePlayerCount)

  for (const player of multiGamePlayers) {
    const otherGames = games.filter((g) => g.code !== player.game)
    if (otherGames.length > 0) {
      const game = faker.helpers.arrayElement(otherGames)
      uniqueIds.push({
        playerId: player.playerId,
        uniqueId: generateSteamId(),
        game: game.code,
      })
    }
  }

  await db.playerUniqueId.createMany({
    data: uniqueIds,
    skipDuplicates: true,
  })

  log(`✔ Created ${uniqueIds.length} player unique IDs.`)
}
