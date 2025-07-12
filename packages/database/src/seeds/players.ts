import { faker } from "@faker-js/faker"
import { db, Prisma } from "../client"
import { getSeedConfig } from "./config"
import { generatePlayerData, generateGameStats } from "./utils"
import { log } from "./logger"

export async function seedPlayers() {
  const config = getSeedConfig()

  const [games, countries, clans] = await Promise.all([
    db.game.findMany(),
    db.country.findMany(),
    db.clan.findMany(),
  ])

  if (games.length === 0 || countries.length === 0) {
    throw new Error("Games and Countries must be seeded first.")
  }

  const players: Prisma.PlayerCreateManyInput[] = []
  for (let i = 0; i < config.players.count; i++) {
    const game = faker.helpers.arrayElement(games)
    const country = faker.helpers.arrayElement(countries)
    const clan = clans.length > 0 && Math.random() < 0.7 ? faker.helpers.arrayElement(clans) : null

    const gameStats = generateGameStats(game.code)
    const playerData = generatePlayerData()

    const player: Prisma.PlayerCreateManyInput = {
      ...gameStats,
      ...playerData,
      game: game.code,
      flag: country.flag,
      clan: clan ? clan.clanId : 0,
    }
    players.push(player)
  }

  await db.player.createMany({
    data: players,
    skipDuplicates: true,
  })

  log(`✔ Created ${players.length} players.`)
}
